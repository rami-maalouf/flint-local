// the lab's wiring: fourteen days, the living flame, and one experiment chosen by ?x=
import { mountLivingFlame } from "./living.js";

const x = new URLSearchParams(location.search).get("x") ?? "feed";
const has = (name) => x === name || x === "all";
document.querySelector(`[data-x="${x}"]`)?.setAttribute("aria-current", "page");
document.getElementById("hint").textContent = {
  feed: "Tap a day: its ember flies into the flame",
  strike: "Press and hold the flame, then let go",
  wind: "Sweep the cursor past the flame",
  all: "Tap a day, hold the flame, sweep past it",
}[x];

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DAYS = 14;
const MISSED = 8;
const days = Array(DAYS).fill(false);
const strip = document.getElementById("days");
const caption = document.getElementById("caption");
const letters = new Intl.DateTimeFormat("en", { weekday: "narrow" });

function flameLevel(checks) {
  let run = 0;
  let misses = 0;
  for (let i = checks.length - 1; i >= 0; i--) {
    if (checks[i]) {
      run++;
      misses = 0;
    } else if (++misses === 2) break;
  }
  if (!checks.at(-1) && !checks.at(-2)) return 0.08;
  const level = 0.3 + 0.7 * Math.min(run / 12, 1);
  return checks.at(-1) ? level : level * 0.62;
}
function describe(checks) {
  const kept = checks.filter(Boolean).length;
  if (kept === 0) return "Each day you check in feeds the flame.";
  if (!checks.at(-1) && !checks.at(-2)) return "Two missed days in a row. Check in today to light it again.";
  if (!checks.at(-1)) return "One missed day. Check in today, and it stays lit.";
  return `${kept} of ${DAYS} days kept. The flame is lit.`;
}

const flame = mountLivingFlame(document.getElementById("flame"), { reduced, level: 0.08 });

const buttons = days.map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (DAYS - 1 - i));
  const b = document.createElement("button");
  b.type = "button";
  b.className = `day${i === DAYS - 1 ? " today" : ""}`;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<span class="pip"></span><span aria-hidden="true">${letters.format(date)}</span>`;
  b.addEventListener("click", () => {
    stopTour();
    toggle(i);
  });
  strip.append(b);
  return b;
});

let touring = false;
function render() {
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(days[i])));
  // while the opening plays, the unlit days ahead are not misses yet
  const kept = days.filter(Boolean).length;
  caption.textContent = touring ? `${kept} ${kept === 1 ? "day" : "days"} kept.` : describe(days);
}

function toggle(i, on = !days[i]) {
  days[i] = on;
  render();
  const level = flameLevel(days);
  if (has("feed") && !reduced) {
    if (on) {
      const r = buttons[i].querySelector(".pip").getBoundingClientRect();
      flame.feed(r.left + r.width / 2, r.top + r.height / 2, () => {
        flame.setLevel(level);
        flame.flare(0.32);
        flame.burst(6, 0.5);
      });
    } else {
      flame.puff();
      flame.setLevel(level);
    }
  } else flame.setLevel(level);
}

// the opening: the days light one by one, one is missed
let tour = null;
const stopTour = () => {
  clearTimeout(tour);
  if (touring) {
    touring = false;
    render();
  }
};
function play(i = 0) {
  touring = i < DAYS;
  if (i >= DAYS) return render();
  if (i !== MISSED) toggle(i, true);
  tour = setTimeout(() => play(i + 1), i === MISSED ? 600 : 300);
}
render();
if (reduced) {
  days.forEach((_, i) => (days[i] = i !== MISSED));
  render();
  flame.setLevel(flameLevel(days));
} else setTimeout(() => play(), 700);

// strike: hold to stoke, let go to throw sparks
if (has("strike")) {
  const slot = document.getElementById("slot");
  let held = 0;
  let raf = 0;
  const grow = () => {
    held = Math.min(held + 0.03, 1);
    flame.stoke(held);
    raf = requestAnimationFrame(grow);
  };
  slot.addEventListener("pointerdown", (e) => {
    slot.setPointerCapture(e.pointerId);
    held = 0.2;
    grow();
  });
  const release = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
    flame.stoke(0);
    flame.flare(0.4 + held * 0.6);
    flame.burst(Math.round(18 + held * 50), 0.8 + held * 0.8);
  };
  slot.addEventListener("pointerup", release);
  slot.addEventListener("pointercancel", release);
}

// wind: the cursor's speed past the flame becomes a gust; on a phone, scrolling does
if (has("wind")) {
  let lx = null;
  let lt = 0;
  addEventListener(
    "pointermove",
    (e) => {
      const now = performance.now();
      if (lx !== null && now > lt) {
        const v = (e.clientX - lx) / (now - lt);
        flame.gust(Math.max(-0.25, Math.min(0.25, v * 0.12)));
      }
      lx = e.clientX;
      lt = now;
      flame.lean((e.clientX / innerWidth - 0.5) * 0.4, (e.clientY / innerHeight - 0.5) * 0.2);
    },
    { passive: true },
  );
  let ly = scrollY;
  addEventListener(
    "scroll",
    () => {
      flame.gust(0, Math.max(-0.2, Math.min(0.2, (ly - scrollY) * 0.01)));
      ly = scrollY;
    },
    { passive: true },
  );
}
