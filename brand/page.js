// one still of the flame, drawn into the page from the options in its address. the renderer
// screenshots it with a headless browser.
import * as THREE from "three";
import { buildFlame, lightFlame, STUDIOS } from "./flame.js";

const q = new URLSearchParams(location.search);
const width = Number(q.get("width"));
const height = Number(q.get("height"));
const studio = q.get("studio");
const fill = Number(q.get("fill") ?? 0.7);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(width, height);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
lightFlame(THREE, scene, renderer);

// the studio: a soft radial light behind the flame, up and to the left
if (studio !== "none") {
  const [a, b, c] = STUDIOS[studio];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const x = canvas.getContext("2d");
  const r = Math.max(width, height);
  const g = x.createRadialGradient(width * 0.42, height * 0.3, 0, width * 0.42, height * 0.3, r);
  g.addColorStop(0, a);
  g.addColorStop(0.58, b);
  g.addColorStop(1, c);
  x.fillStyle = g;
  x.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture;
}

if (q.get("flame") !== "none") scene.add(buildFlame(THREE, { palette: q.get("palette"), grid: 420 }));

// the flame is about 2.44 units tall; place the camera so it fills "fill" of the frame's height
const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
const span = 2.44 / fill;
camera.position.set(0, 0.06, span / (2 * Math.tan(THREE.MathUtils.degToRad(14))));
camera.lookAt(0, 0, 0);
renderer.render(scene, camera);
document.title = "done";
