// writes a ripples.db with fifteen months of believable habit history that
// ends today, for the store screenshots. it runs the app's own domain commands
// (the same ones the ui calls) against bun:sqlite, so the file is exactly what
// the app would have written itself; install-store-data.sh copies it into the
// simulator. nothing here ships in the app.
//
//   bun goldie/seed/seed-store-data.ts [out.db]
import { Database } from 'bun:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { createEconomicDayCloseResolver } from '@/core/calendar/economic-day-close';
import { addDays, daysBetween, isoWeekday } from '@/core/calendar/logical-date';
import { createBoard, createCheckIn } from '@/core/domain/commands';
import type { BoardId, CommandId, LogicalDate } from '@/core/domain/ids';
import type { Clock, Hashing, IdGenerator } from '@/core/domain/ports';
import { getCoinTotals } from '@/core/domain/coin-queries';
import { claimReward, createReward } from '@/core/domain/reward-commands';
import { listRewards } from '@/core/domain/reward-queries';
import type { DomainResult } from '@/core/domain/result';
import { initializeProductDatabase } from '@/core/persistence/bootstrap';
import type { SqlDatabase, SqlExecutor, SqlParams } from '@/core/persistence/database';

class BunSqlDatabase implements SqlDatabase {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly db: Database) {}

  private enqueue<Value>(run: () => Promise<Value>): Promise<Value> {
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  async runAsync(sql: string, params: SqlParams = []) {
    const result = this.db.prepare(sql).run(...(params as never[]));
    return { changes: Number(result.changes) };
  }
  async getAllAsync<Row>(sql: string, params: SqlParams = []) {
    return this.db.prepare(sql).all(...(params as never[])) as Row[];
  }
  async getFirstAsync<Row>(sql: string, params: SqlParams = []) {
    return (this.db.prepare(sql).get(...(params as never[])) as Row | null) ?? null;
  }
  async execAsync(sql: string) {
    this.db.exec(sql);
  }
  private transaction<Value>(begin: string, work: (tx: SqlExecutor) => Promise<Value>) {
    return this.enqueue(async () => {
      this.db.exec(begin);
      try {
        const value = await work(this);
        this.db.exec('COMMIT');
        return value;
      } catch (cause) {
        this.db.exec('ROLLBACK');
        throw cause;
      }
    });
  }
  withExclusiveTransactionAsync<Value>(work: (tx: SqlExecutor) => Promise<Value>) {
    return this.transaction('BEGIN EXCLUSIVE', work);
  }
  withTransactionAsync<Value>(work: (tx: SqlExecutor) => Promise<Value>) {
    return this.transaction('BEGIN', work);
  }
  async closeAsync() {
    this.db.close();
  }
}

async function completed<T>(result: Promise<DomainResult<T>>): Promise<T> {
  const outcome = await result;
  if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
  return outcome.value;
}

// the habits follow the app's own sample mode (src/core/sample/generator.ts),
// with shorter titles so they fit the two-column grid without truncation.
// streak: days in a row ending today (or yesterday for evening habits).
// halfMisses: single missed days inside the run, so the plain streak resets
// while the half streak ("never miss twice") keeps going.
type Habit = {
  title: string; symbol: string; accent: string; minute: number;
  streak: number; halfMisses?: number[]; weekdays?: number[]; rate: number;
  count?: boolean;
};
const habits: Habit[] = [
  { title: 'Stretch', symbol: 'figure.mind.and.body', accent: '#69B578', minute: 420, streak: 34, rate: 0.85 },
  { title: 'Drink water', symbol: 'drop.fill', accent: '#4C9ACB', minute: 425, streak: 112, rate: 0.92 },
  { title: 'Read a page', symbol: 'book.fill', accent: '#B482B8', minute: 430, streak: 61, halfMisses: [6, 19, 33, 47], rate: 0.8 },
  { title: 'Plan the day', symbol: 'checklist', accent: '#D29C52', minute: 440, streak: 21, rate: 0.82 },
  { title: 'Take a walk', symbol: 'figure.walk', accent: '#72A98F', minute: 1020, streak: 9, rate: 0.7 },
  { title: 'Make something', symbol: 'paintbrush.fill', accent: '#CD7D8A', minute: 1080, streak: 0, weekdays: [2, 4, 6], rate: 0.8 },
  { title: 'Wind down', symbol: 'moon.stars.fill', accent: '#7E86C4', minute: 1290, streak: 27, rate: 0.8 },
  { title: 'Deep work', symbol: 'timer', accent: '#648EA5', minute: 600, streak: 0, weekdays: [1, 2, 3, 4, 5], rate: 0.85, count: true },
];
const rewards = [
  ['A favorite drink', 5, 'cup.and.saucer.fill', '#D29C52'],
  ['An afternoon at a cafe', 15, 'book.fill', '#B482B8'],
  ['A cinema visit', 40, 'play.rectangle.fill', '#CD7D8A'],
  ['A day trip', 120, 'suitcase.fill', '#4C9ACB'],
] as const;
// a few journal lines on reading and making days, newest first
const notes: Record<string, string[]> = {
  'Read a page': [
    'Two chapters before work. Worth the early alarm.',
    'Only one page tonight, but it still counts.',
    'Finished the book on the train home.',
    'Started a new novel. Slow first chapter, good second.',
  ],
  'Make something': [
    'Sketched the view from the balcony in ink.',
    'Glazed the two small bowls.',
    'Twenty minutes of watercolor. Loose and quick.',
  ],
};

const zone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const out = resolve(process.argv[2] ?? 'goldie/seed/out/ripples.db');
// SEED_NOW (any Date.parse string) pins the moment the history ends, so a
// recapture later the same day shows exactly the same checks and coins
const nowMs = process.env.SEED_NOW ? Date.parse(process.env.SEED_NOW) : Date.now();
const today = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: zone }) as LogicalDate;
const start = addDays(today, -440);

let now = Date.parse(`${start}T08:00:00Z`);
const clock: Clock = { nowUtcMs: () => now, timeZoneId: () => zone };
const ids: IdGenerator = { uuid: () => randomUUID() };
const hashing: Hashing = {
  sha1: async (bytes) => new Uint8Array(createHash('sha1').update(bytes).digest()),
  sha256: async (bytes) => new Uint8Array(createHash('sha256').update(bytes).digest()),
};

rmSync(out, { force: true });
const raw = new Database(out, { create: true });
const db = new BunSqlDatabase(raw);
await completed(initializeProductDatabase(db, ids, hashing));
const deps = { db, hashing, clock, ids };
const commandId = () => ids.uuid() as CommandId;

const boards: BoardId[] = [];
for (const [index, habit] of habits.entries()) {
  const count = Boolean(habit.count);
  const { boardId } = await completed(createBoard(deps, {
    commandId: commandId(), title: habit.title, symbol: habit.symbol, accentHex: habit.accent,
    kind: count ? 'count' : 'daily', usesTintedBackground: false, tracksAmount: count, tracksTime: count,
    amountUnit: count ? 'minutes' : null, quickAmount: count ? 25 : 1, startOfDayMinute: 0,
    metricsEnabled: true, requiredInStack: index < 4, earnsCoins: true, coinCapPerDay: count ? 3 : 1,
    anchor: index === 0 ? { kind: 'preset', relation: 'after', preset: 'wake' }
      : index < 4 ? { kind: 'board', relation: 'after', boardId: boards[index - 1] } : null,
  }));
  boards.push(boardId);
  now += 60_000;
}
for (const [title, costCoins, symbol, accentHex] of rewards) {
  await completed(createReward(deps, { commandId: commandId(), title, costCoins, symbol, accentHex }));
  now += 60_000;
}

let randomState = 20261120;
const random = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
};
const noon = createEconomicDayCloseResolver(zone);
const pendingNotes = Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, [...v]]));
const vacation = (date: LogicalDate) => date >= addDays(today, -250) && date <= addDays(today, -243);
let checkIns = 0;
let claims = 0;

for (let date = start; date <= today; date = addDays(date, 1)) {
  const age = daysBetween(date, today);
  const weekday = isoWeekday(date);
  const localNoon = noon(addDays(date, -1), 720);
  const at = (minute: number) => localNoon + (minute - 720) * 60_000;
  for (const [index, habit] of habits.entries()) {
    const roll = random();
    const jitter = Math.floor(random() * 12);
    if (vacation(date)) continue;
    // evening habits are still open today; their streak runs to yesterday
    const runAge = at(habit.minute) > nowMs ? age - 1 : age;
    let checked: boolean;
    if (habit.streak > 0 && runAge >= 0 && runAge < habit.streak) {
      checked = !(habit.halfMisses ?? []).includes(runAge);
    } else if (habit.streak > 0 && runAge === habit.streak) {
      checked = false;
    } else if (habit.weekdays) {
      checked = habit.weekdays.includes(weekday) && roll < habit.rate;
    } else {
      checked = roll < (weekday <= 5 ? habit.rate : habit.rate - 0.25);
    }
    if (!checked) continue;
    const sessions = habit.count ? (roll < 0.3 ? 1 : roll < 0.75 ? 2 : 3) : 1;
    for (let session = 0; session < sessions; session += 1) {
      const instant = at(habit.minute + jitter + session * 90);
      if (instant > nowMs) break;
      now = instant;
      const queue = pendingNotes[habit.title];
      const note = queue && age <= 40 && age % 9 === 2 ? queue.shift() : undefined;
      await completed(createCheckIn(deps, {
        commandId: commandId(), boardId: boards[index], source: 'app',
        amount: habit.count ? (session % 2 === 0 ? 25 : 45) : undefined, note,
      }));
      checkIns += 1;
    }
  }
  // spend the way a person would: a drink most weeks, a cafe afternoon now and
  // then, a film each month and a day trip each season, so the balance stays
  // a believable few dozen coins instead of piling up
  if (age > 0) {
    const plan: [number, number][] = [[2, 0], [6, 1], [20, 2], [50, 3]];
    for (const [every, rewardIndex] of plan) {
      if (age % every !== 0) continue;
      const balance = (await completed(getCoinTotals(deps))).balance;
      const available = await completed(listRewards(deps));
      const reward = available[rewardIndex];
      if (balance - reward.costCoins < 30) continue;
      now = at(1140 + rewardIndex);
      const claimed = await claimReward(deps, {
        commandId: commandId(), rewardId: reward.id, expectedMutationStamp: reward.mutationStamp,
      });
      if (claimed.ok) claims += 1;
    }
  }
}

const balance = (await completed(getCoinTotals(deps))).balance;
raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
await db.closeAsync();
console.log(JSON.stringify({ out, zone, today, boards: boards.length, checkIns, claims, balance }));
