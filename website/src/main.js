// the page: entrances, the frosted bar, the fourteen days that feed the flame, and the deferred
// load of the 3d scene.

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

requestAnimationFrame(() => document.body.classList.add("ready"));

// the waitlist forms, in the hero and the close: each one posts to /api/waitlist, which adds the
// email to the notion waitlist with the platforms picked. each group (mobile, desktop) takes one
// pick, and one platform always stays picked.
const PLATFORM_NAMES = { iOS: "iPhone", macOS: "Mac" };
for (const form of document.querySelectorAll("[data-waitlist]")) {
  const note = form.querySelector(".form-note");
  const button = form.querySelector('button[type="submit"]');
  const email = form.elements.email;
  const intro = note.textContent;
  const label = button.textContent;
  const say = (state, text) => {
    form.dataset.state = state;
    note.textContent = text;
  };

  form.addEventListener("input", () => {
    if (form.dataset.state === "error") say("idle", intro);
  });

  const chips = [...form.querySelectorAll('input[name="platforms"]')];
  for (const chip of chips) {
    chip.addEventListener("change", () => {
      if (chip.checked) {
        // a new pick replaces the other one in its group
        for (const other of chip.closest(".group").querySelectorAll('input[name="platforms"]')) {
          if (other !== chip) other.checked = false;
        }
      } else if (!chips.some((c) => c.checked)) {
        // the last pick stays: there is always one platform to tell you about
        chip.checked = true;
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.state === "sending") return;
    const platforms = [...form.querySelectorAll('input[name="platforms"]:checked')].map((i) => i.value);
    const address = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      say("error", "Use a valid email address.");
      email.focus();
      return;
    }
    if (platforms.length === 0) {
      say("error", "Pick a mobile platform, a desktop platform, or one of each.");
      return;
    }

    say("sending", "Adding you to the list…");
    button.disabled = true;
    button.textContent = "Joining…";
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, platforms, company: form.elements.company.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We could not save that. Try again in a minute.");
      const names = platforms.map((p) => PLATFORM_NAMES[p] ?? p).join(" and ");
      say(
        "done",
        data.alreadyAdded && !data.added?.length
          ? "You are already on the list."
          : `You are on the list. We will email you when Flint is ready for ${names}.`,
      );
      button.textContent = "On the list";
      for (const input of form.querySelectorAll("input")) input.disabled = true;
    } catch (error) {
      say("error", error instanceof Error && error.message !== "Failed to fetch" ? error.message : "No connection. Try again.");
      button.disabled = false;
      button.textContent = label;
    }
  });
}

// the bar frosts once the page has scrolled
const bar = document.querySelector(".bar");
const frost = () => bar.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", frost, { passive: true });
frost();

// sections rise in as they arrive
const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("seen");
      seen.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -10% 0px" },
);
document.querySelectorAll(".observe").forEach((el) => seen.observe(el));

// the last fourteen days, ending today. each checked day feeds the flame; one missed day dims
// it, two in a row let it burn down to an ember. it is the app's never-miss-twice rule.
const DAYS = 14;
const MISSED = 8;
const days = Array.from({ length: DAYS }, () => false);
const listeners = new Set();
// who hears a single day change: the live flame, which sends that day's ember into the fire
const dayListeners = new Set();
const strip = document.getElementById("days");
const caption = document.getElementById("caption");
const letters = new Intl.DateTimeFormat("en", { weekday: "narrow" });
const names = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" });

const buttons = days.map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (DAYS - 1 - i));
  const b = document.createElement("button");
  b.type = "button";
  b.className = `day${i === DAYS - 1 ? " today" : ""}`;
  b.setAttribute("aria-pressed", "false");
  b.setAttribute("aria-label", i === DAYS - 1 ? `Today, ${names.format(date)}` : names.format(date));
  b.innerHTML = `<span class="pip"></span><span aria-hidden="true">${letters.format(date)}</span>`;
  b.addEventListener("click", () => {
    stopTour();
    days[i] = !days[i];
    update();
    for (const listen of dayListeners) listen(i, days[i]);
  });
  strip.append(b);
  return b;
});

// how lit the flame is, from 0 (an ember) to 1, read from the end of the strip backwards
export function flameLevel(checks) {
  let run = 0;
  let misses = 0;
  for (let i = checks.length - 1; i >= 0; i--) {
    if (checks[i]) {
      run++;
      misses = 0;
    } else if (++misses === 2) break;
  }
  const last = checks.at(-1);
  const before = checks.at(-2);
  if (!last && !before) return 0.08;
  const level = 0.3 + 0.7 * Math.min(run / 12, 1);
  return last ? level : level * 0.62;
}

function describe(checks) {
  const last = checks.at(-1);
  const before = checks.at(-2);
  const kept = checks.filter(Boolean).length;
  if (kept === 0) return "Each day you check in feeds the flame.";
  if (!last && !before) return "Two missed days in a row. Check in today to light it again.";
  if (!last) return "One missed day. Check in today, and it stays lit.";
  return `${kept} of ${DAYS} days kept. The flame is lit.`;
}

let touring = false;
function update() {
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(days[i])));
  const level = flameLevel(days);
  // while the opening plays, the unlit days ahead are not misses yet
  const kept = days.filter(Boolean).length;
  caption.textContent = touring ? `${kept} ${kept === 1 ? "day" : "days"} kept.` : describe(days);
  document.querySelector(".flame-slot").style.setProperty("--glow", String(0.25 + level * 0.75));
  for (const listen of listeners) listen(level);
}

// the opening: the days light one by one, one of them is missed, and the flame grows
let tour = null;
function stopTour() {
  clearTimeout(tour);
  tour = null;
  if (touring) {
    touring = false;
    update();
  }
}
function play(i = 0) {
  touring = i < DAYS;
  if (i >= DAYS) return update();
  days[i] = i !== MISSED;
  update();
  if (days[i]) for (const listen of dayListeners) listen(i, true);
  tour = setTimeout(() => play(i + 1), i === MISSED ? 700 : 260);
}

if (reduced) {
  days.forEach((_, i) => (days[i] = i !== MISSED));
  update();
} else {
  update();
  setTimeout(() => play(), 900);
}

// the 3d flame loads after the page has painted. without webgl, the still stays.
const canvas = document.getElementById("flame");
const webgl = (() => {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
})();
if (webgl) {
  const start = () =>
    import("./scene.js")
      .then(({ mountFlame }) => {
        const slot = document.querySelector(".flame-slot");
        const flame = mountFlame(canvas, { reduced, level: flameLevel(days), slot });
        if (reduced) listeners.add(flame.setLevel);
        else {
          // a checked day's ember flies from its dot into the flame, which grows when it lands;
          // an undone day sends up smoke
          dayListeners.add((i, on) => {
            if (!on) return flame.douse(flameLevel(days));
            const r = buttons[i].querySelector(".pip").getBoundingClientRect();
            flame.feed(r.left + r.width / 2, r.top + r.height / 2, () => flame.land(flameLevel(days)));
          });
          const hint = document.createElement("p");
          hint.className = "flame-hint";
          hint.textContent = "Tap a day, or press and hold the flame.";
          caption.after(hint);
        }
        slot.classList.add("live");
      })
      .catch(() => undefined);
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 300);
}
