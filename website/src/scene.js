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

  // the hearth is website scenery; the shared icon geometry stays untouched.
  const hearth = new THREE.Group();
  scene.add(hearth);
  const metal = new THREE.MeshStandardMaterial({ color: 0x253c4a, metalness: 0.85, roughness: 0.28 });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.28, 0.22, 96), metal);
  pedestal.position.y = -1.4;
  hearth.add(pedestal);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.035, 96), new THREE.MeshStandardMaterial({ color: 0x101c29, metalness: 0.2, roughness: 0.65 }));
  top.position.y = -1.27;
  hearth.add(top);
  const luminous = new THREE.MeshBasicMaterial({ color: 0x57dcd2, transparent: true, opacity: 0.65 });
  function ring(radius, tube, y, material) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 120), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    hearth.add(mesh);
    return mesh;
  }
  ring(1.2, 0.012, -1.3, luminous);
  ring(1.26, 0.008, -1.49, luminous);
  ring(1.53, 0.006, -1.52, new THREE.MeshBasicMaterial({ color: 0x5d96a0, transparent: true, opacity: 0.3 }));
  const orbit = ring(1.52, 0.009, -0.04, luminous);
  orbit.rotation.set(1.05, 0.3, -0.45);
  // sparse embers with deterministic placement.
  const positions = new Float32Array(54 * 3);
  for (let i = 0; i < 54; i++) {
    const angle = i * 2.39996;
    const radius = 1.15 + (i % 7) * 0.1;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = -1.2 + (i / 54) * 2.9;
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.6;
  }
  const particles = new THREE.BufferGeometry();
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const embers = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0x89eddc, size: 0.018, transparent: true, opacity: 0.6 }));
  scene.add(embers);

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
  const span = 4.5;
  camera.position.set(0, 1.1, span / (2 * Math.tan(THREE.MathUtils.degToRad(14))));
  camera.lookAt(0, -0.1, 0);

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
      if (reduced) return;
      target.y = (e.clientX / innerWidth - 0.5) * 0.5;
      target.x = (e.clientY / innerHeight - 0.5) * 0.24;
    },
    { passive: true },
  );

  function apply(t) {
    const s = 0.52 + 0.48 * now.level;
    flame.scale.setScalar(s);
    flame.position.y = 0.15 - 1.1 * (1 - s) + (reduced ? 0 : Math.sin(t * 1.2) * 0.035);
    hearth.rotation.y = now.y * 0.2;
    orbit.rotation.z = -0.45 + (reduced ? 0 : t * 0.07);
    embers.rotation.y = reduced ? 0 : t * 0.035;
    luminous.opacity = 0.2 + now.level * 0.45;
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
