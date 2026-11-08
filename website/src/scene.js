// the live flame: the app icon's own flame (brand/flame.js) made to behave like fire. waves lick
// up its body, the tips stretch and curl, embers rise off it, and a warm glow pools beneath it.
// each day checked sends an ember into it; hold the flame to stoke it and let go to throw sparks;
// sweep the cursor past it, or scroll, and it bends in the gust. it draws only while on screen.
import * as THREE from "three";
import { buildFlame, lightFlame } from "../../brand/flame.js";

const EMBER_COLORS = ["#b6ef4a", "#22d3c5", "#5fe6ff", "#3b82ff", "#e9ffb0"];

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function mountFlame(canvas, { reduced = false, level: initial = 0.9, slot = canvas.parentElement } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  lightFlame(THREE, scene, renderer);
  const flame = buildFlame(THREE, { palette: "aurora", grid: 300 });
  scene.add(flame);

  // the fire's motion lives in the vertex shader, so it costs nothing on the cpu
  const u = {
    uTime: { value: 0 },
    uLife: { value: reduced ? 0 : 1 },
    uWind: { value: new THREE.Vector2() },
    uFlare: { value: 0 },
  };
  const { outer, inner } = flame.userData;
  const animate = (m, phase) => {
    const tint = m.onBeforeCompile;
    m.onBeforeCompile = (shader, r) => {
      tint(shader, r);
      Object.assign(shader.uniforms, u, { uPhase: { value: phase } });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime, uLife, uFlare, uPhase;\nuniform vec2 uWind;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float t = uTime + uPhase;
          float rise = smoothstep(-1.2, 1.35, position.y);
          float tip = rise * rise;
          // waves that travel up the body, faster and smaller toward the tips
          float lick = sin(t * 2.3 - position.y * 2.8) * 0.055 + sin(t * 4.1 - position.y * 5.2 + position.x * 2.4) * 0.022;
          transformed.x += lick * tip * uLife;
          // the tips reach up and fall back, each on its own beat
          transformed.y += (0.5 + 0.5 * sin(t * 3.4 + position.x * 7.0)) * 0.085 * tip * rise * uLife;
          // the body breathes
          transformed.x *= 1.0 + sin(t * 1.6) * 0.018 * uLife * (1.0 - rise);
          // a flare stretches the flame up; wind bends the upper flame and lays it down a little
          transformed.y += uFlare * 0.26 * tip;
          transformed.x *= 1.0 + uFlare * 0.12 * (1.0 - rise);
          transformed.x += uWind.x * 0.9 * tip;
          transformed.y += uWind.y * 0.4 * tip - abs(uWind.x) * 0.24 * tip;`,
        );
    };
  };
  outer.forEach((m) => animate(m, 0));
  inner.forEach((m) => animate(m, 1.7));

  // a warm pool of light under the flame, so it stands somewhere
  const glow = glowTexture();
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.3),
    new THREE.MeshBasicMaterial({ map: glow, color: "#2fd1c7", transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2.25;
  pool.position.set(0, -1.32, 0.1);
  scene.add(pool);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#3b82ff", transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(2.9, 3.2, 1);
  halo.position.set(0, 0.1, -0.8);
  scene.add(halo);

  // embers: one instanced mesh of small glowing beads, recycled
  const MAX = 160;
  const bead = new THREE.SphereGeometry(1, 12, 8);
  const embers = new THREE.InstancedMesh(bead, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX);
  embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // the embers move every frame; a bounding sphere computed once would cull them for good
  embers.frustumCulled = false;
  scene.add(embers);
  const sparks = Array.from({ length: MAX }, () => ({ alive: false }));
  const tint = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scaleV = new THREE.Vector3();
  const posV = new THREE.Vector3();
  function spawn(s) {
    const free = sparks.find((p) => !p.alive);
    if (!free) return null;
    Object.assign(free, { alive: true, age: 0, life: 1.6, size: 0.035, drag: 0.6, gravity: -0.2, path: null, onArrive: null }, s);
    free.vel = free.vel ?? new THREE.Vector3();
    tint.set(s.color ?? EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0]).multiplyScalar(s.bright ?? 2.2);
    embers.setColorAt(sparks.indexOf(free), tint);
    embers.instanceColor.needsUpdate = true;
    return free;
  }
  // seed the colour buffer
  embers.setColorAt(0, tint.set("#ffffff"));

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const span = 2.44 / 0.64;
  camera.position.set(0, 0.06, span / (2 * Math.tan(THREE.MathUtils.degToRad(14))));
  camera.lookAt(0, 0, 0);
  const size = () => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  size();
  new ResizeObserver(size).observe(canvas);

  const state = { level: reduced ? initial : 0.05, target: initial, flare: 0, wind: new THREE.Vector2(), windTarget: new THREE.Vector2(), lean: new THREE.Vector2(), leanTarget: new THREE.Vector2(), stoke: 0 };
  const scaleFor = (l) => 0.5 + 0.5 * l;
  // where the flame's tips and heart are, in the world, at the current size
  const tipPoint = () => {
    const s = scaleFor(state.level);
    return new THREE.Vector3((Math.random() - 0.5) * 0.9 * s, (0.2 + Math.random() * 0.8) * s - 1.15 * (1 - s), 0.25);
  };
  const heart = () => {
    const s = scaleFor(state.level);
    return new THREE.Vector3(0.02, -0.45 * s - 1.15 * (1 - s), 0.55);
  };

  // a point on the page, carried into the world on the plane z = 0.3
  function worldFromScreen(x, y) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector3(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1, 0.5);
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const t = (0.3 - camera.position.z) / dir.z;
    return camera.position.clone().addScaledVector(dir, t);
  }

  let emitClock = 0;
  function step(dt) {
    u.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 3.5);
    state.level += (state.target - state.level) * k;
    state.flare = Math.max(0, state.flare - dt * 1.4) + state.stoke * dt * 2;
    state.flare = Math.min(state.flare, 1.2);
    state.wind.lerp(state.windTarget, 1 - Math.exp(-dt * 5));
    state.windTarget.multiplyScalar(Math.exp(-dt * 2.5));
    state.lean.lerp(state.leanTarget, 1 - Math.exp(-dt * 4));
    u.uFlare.value = state.flare;
    u.uWind.value.copy(state.wind);

    const s = scaleFor(state.level) * (1 + state.flare * 0.05);
    flame.scale.setScalar(s);
    flame.position.y = -1.15 * (1 - scaleFor(state.level));
    flame.rotation.y = -0.32 + state.lean.x + Math.sin(u.uTime.value * 0.45) * 0.07;
    flame.rotation.x = 0.12 + state.lean.y;
    for (const m of outer) m.emissiveIntensity = 0.1 + 0.26 * state.level + state.flare * 0.35;
    for (const m of inner) m.emissiveIntensity = 0.16 + 0.34 * state.level + state.flare * 0.5;
    pool.material.opacity = 0.06 + 0.22 * state.level + state.flare * 0.2;
    halo.material.opacity = 0.08 + 0.28 * state.level + state.flare * 0.3;
    canvas.style.setProperty("--heat", String(state.level + state.flare * 0.5));

    // a steady drift of embers off the tips; more when the fire is big or stoked
    emitClock += dt * (1.2 + state.level * 5 + state.flare * 18 + state.stoke * 30);
    while (emitClock > 1) {
      emitClock -= 1;
      const from = tipPoint();
      spawn({
        pos: from,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.3 + state.wind.x * 1.2, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.2),
        life: 1.2 + Math.random() * 1.4,
        size: 0.012 + Math.random() * 0.026,
        gravity: 0.15,
        drag: 0.3,
      });
    }

    let i = 0;
    for (const p of sparks) {
      if (p.alive) {
        p.age += dt;
        if (p.path) {
          // an ember carried along a curve, into the heart of the flame
          const t = Math.min(p.age / p.life, 1);
          const e = t * t * (3 - 2 * t);
          const a = p.path[0];
          const b = p.path[1];
          const c = heart();
          posV.set(
            (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * b.x + e * e * c.x,
            (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * b.y + e * e * c.y,
            (1 - e) * (1 - e) * a.z + 2 * (1 - e) * e * b.z + e * e * c.z,
          );
          p.pos.copy(posV);
          if (t >= 1) {
            p.alive = false;
            p.onArrive?.();
          }
        } else {
          p.vel.y += p.gravity * dt;
          p.vel.x += state.wind.x * dt * 2.2;
          p.vel.multiplyScalar(Math.exp(-p.drag * dt));
          p.pos.addScaledVector(p.vel, dt);
          p.pos.x += Math.sin(p.age * 9 + p.pos.y * 4) * 0.0025;
          if (p.age > p.life) p.alive = false;
        }
      }
      const fade = p.alive ? (p.path ? 1 : Math.sin(Math.PI * Math.min(p.age / p.life, 1)) ** 0.6) : 0;
      scaleV.setScalar(p.alive ? p.size * fade : 0);
      m4.compose(p.alive ? p.pos : posV.set(0, -99, 0), q, scaleV);
      embers.setMatrixAt(i++, m4);
    }
    embers.instanceMatrix.needsUpdate = true;
  }

  let running = false;
  let last = performance.now();
  function frame(ms) {
    if (!running) return;
    const dt = Math.min((ms - last) / 1000, 0.05);
    last = ms;
    step(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  };
  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    setRunning(visible && !document.hidden && !reduced);
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => setRunning(visible && !document.hidden && !reduced));
  if (reduced) {
    step(0);
    renderer.render(scene, camera);
  } else setRunning(true);

  const redraw = () => {
    if (reduced) {
      state.level = state.target;
      step(0);
      renderer.render(scene, camera);
    }
  };

  const api = {
    canvas,
    setLevel(level) {
      state.target = level;
      redraw();
    },
    // a burst of light: the flame reaches up and glows, then settles
    flare(amount = 0.5) {
      state.flare = Math.min(1.2, state.flare + amount);
    },
    // hold to stoke: 0 to 1 while a press is held
    stoke(amount) {
      state.stoke = amount;
    },
    // a gust, in rough screen units: x to the right, y up
    gust(x, y = 0) {
      state.windTarget.x = THREE.MathUtils.clamp(state.windTarget.x + x, -0.9, 0.9);
      state.windTarget.y = THREE.MathUtils.clamp(state.windTarget.y + y, -0.6, 0.6);
    },
    lean(x, y) {
      state.leanTarget.set(x, y);
    },
    // a spray of sparks thrown out of the flame
    burst(count = 30, power = 1) {
      for (let n = 0; n < count; n++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (0.8 + Math.random() * 1.6) * power;
        spawn({
          pos: tipPoint().multiplyScalar(0.6),
          vel: new THREE.Vector3(Math.cos(a) * speed, Math.abs(Math.sin(a)) * speed * 1.2 + 0.6, (Math.random() - 0.5) * 0.6),
          life: 0.8 + Math.random() * 0.9,
          size: 0.018 + Math.random() * 0.03,
          gravity: -2.4,
          drag: 1.2,
          bright: 3,
        });
      }
    },
    // an ember from a point on the page that curves into the heart of the flame
    feed(x, y, onArrive) {
      const from = worldFromScreen(x, y);
      const to = heart();
      const mid = from.clone().lerp(to, 0.5);
      mid.x += (Math.random() - 0.5) * 0.8;
      mid.y += 0.9;
      spawn({ pos: from.clone(), path: [from, mid], life: 0.9, size: 0.055, bright: 3, onArrive });
      // a short trail of smaller beads behind it
      for (let n = 1; n <= 4; n++) {
        setTimeout(() => spawn({ pos: from.clone(), path: [from, mid], life: 0.9, size: 0.04 - n * 0.006, bright: 2 }), n * 40);
      }
    },
    // a grey puff leaves the flame: a day was undone
    puff() {
      for (let n = 0; n < 10; n++) {
        spawn({
          pos: tipPoint(),
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.4, 0),
          life: 1.4,
          size: 0.03 + Math.random() * 0.03,
          color: "#5a6787",
          bright: 1,
          gravity: 0.1,
        });
      }
    },
    // an ember arrived: the flame takes the new level, and flares
    land(level) {
      api.setLevel(level);
      api.flare(0.32);
      api.burst(6, 0.5);
    },
    // a day was undone: smoke leaves, and the flame settles lower
    douse(level) {
      api.puff();
      api.setLevel(level);
    },
  };
  if (reduced) return api;

  // strike: press and hold the flame to stoke it, let go to throw sparks. a scroll that starts
  // on the flame cancels the stoke quietly, so phones can still scroll past it.
  let held = 0;
  let holding = 0;
  const stokeUp = () => {
    held = Math.min(held + 0.03, 1);
    api.stoke(held);
    holding = requestAnimationFrame(stokeUp);
  };
  const letGo = (spark) => {
    if (!holding) return;
    cancelAnimationFrame(holding);
    holding = 0;
    api.stoke(0);
    if (!spark) return;
    api.flare(0.4 + held * 0.6);
    api.burst(Math.round(18 + held * 50), 0.8 + held * 0.8);
  };
  slot.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    held = 0.2;
    stokeUp();
  });
  slot.addEventListener("pointerup", () => letGo(true));
  slot.addEventListener("pointerleave", () => letGo(true));
  slot.addEventListener("pointercancel", () => letGo(false));

  // wind: a mouse sweeping past becomes a gust, and the flame leans toward the cursor; on a
  // phone, scrolling does it
  let lastX = null;
  let lastT = 0;
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (lastX !== null && now > lastT) api.gust(Math.max(-0.25, Math.min(0.25, ((e.clientX - lastX) / (now - lastT)) * 0.12)));
      lastX = e.clientX;
      lastT = now;
      api.lean((e.clientX / innerWidth - 0.5) * 0.4, (e.clientY / innerHeight - 0.5) * 0.2);
    },
    { passive: true },
  );
  let lastY = scrollY;
  addEventListener(
    "scroll",
    () => {
      api.gust(0, Math.max(-0.2, Math.min(0.2, (lastY - scrollY) * 0.01)));
      lastY = scrollY;
    },
    { passive: true },
  );
  return api;
}
