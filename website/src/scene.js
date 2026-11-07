// the live flame: the app icon's own flame (brand/flame.js), flickering, leaning toward the
// cursor, and growing or dimming with the days it is fed. it draws only while it is on screen.
import * as THREE from "three";
import { buildFlame, lightFlame } from "../../brand/flame.js";

export function mountFlame(canvas, { reduced, level: initial }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  lightFlame(THREE, scene, renderer);
  const flame = buildFlame(THREE, { palette: "aurora", grid: 320 });
  scene.add(flame);

  // flicker: the upper flame sways sideways and stretches, more toward the tips
  const time = { value: 0 };
  const flicker = { value: reduced ? 0 : 1 };
  const { outer, inner } = flame.userData;
  for (const m of [...outer, ...inner]) {
    const tint = m.onBeforeCompile;
    m.onBeforeCompile = (shader, r) => {
      tint(shader, r);
      shader.uniforms.uTime = time;
      shader.uniforms.uFlicker = flicker;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uFlicker;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float rise = smoothstep(-0.7, 1.3, position.y);
          transformed.x += (sin(uTime * 2.6 + position.y * 3.1) * 0.034 + sin(uTime * 4.7 + position.y * 5.3) * 0.012) * rise * uFlicker;
          transformed.y += sin(uTime * 3.3 + position.x * 2.0) * 0.022 * rise * rise * uFlicker;`,
        );
    };
  }

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const span = 2.44 / 0.8;
  camera.position.set(0, 0.06, span / (2 * Math.tan(THREE.MathUtils.degToRad(14))));
  camera.lookAt(0, 0, 0);

  const size = () => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  size();
  new ResizeObserver(() => {
    size();
    if (!running) draw();
  }).observe(canvas);

  // springs toward the target: the level the days set, and the cursor's lean
  const target = { level: initial, x: 0, y: 0 };
  const now = { level: reduced ? initial : 0.05, x: 0, y: 0 };
  addEventListener(
    "pointermove",
    (e) => {
      target.y = (e.clientX / innerWidth - 0.5) * 0.5;
      target.x = (e.clientY / innerHeight - 0.5) * 0.24;
    },
    { passive: true },
  );

  function apply(t) {
    const s = 0.52 + 0.48 * now.level;
    flame.scale.setScalar(s);
    flame.position.y = -1.1 * (1 - s);
    for (const m of outer) m.emissiveIntensity = 0.1 + 0.26 * now.level;
    for (const m of inner) m.emissiveIntensity = 0.16 + 0.34 * now.level;
    flicker.value = reduced ? 0 : 0.35 + 0.65 * now.level;
    flame.rotation.y = -0.32 + now.y + (reduced ? 0 : Math.sin(t * 0.5) * 0.06);
    flame.rotation.x = 0.12 + now.x;
  }

  function draw(t = 0) {
    apply(t);
    renderer.render(scene, camera);
  }

  let running = false;
  let visible = true;
  let last = performance.now();
  function frame(ms) {
    if (!running) return;
    const dt = Math.min((ms - last) / 1000, 0.05);
    last = ms;
    time.value += dt;
    const k = 1 - Math.exp(-dt * 4);
    now.level += (target.level - now.level) * k;
    now.x += (target.x - now.x) * k;
    now.y += (target.y - now.y) * k;
    draw(time.value);
    requestAnimationFrame(frame);
  }
  function setRunning(on) {
    if (reduced || on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    setRunning(visible && !document.hidden);
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => setRunning(visible && !document.hidden));

  draw();
  setRunning(true);

  return {
    setLevel(level) {
      target.level = level;
      if (reduced) {
        now.level = level;
        draw();
      }
    },
  };
}
