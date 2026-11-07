// the flint flame: a drawn 2d outline, puffed up into glossy toy plastic that glows in its own
// colours. the brand renderer and the website both build it from here.
//
// it imports nothing: callers pass their own three.js, so one copy of three is ever bundled.

// the crown: a tall middle tongue with a flick on each side, and an inner flame, in a 512
// square with y pointing down
export const OUTER =
  "M256 480 C356 480 418 416 418 330 C418 270 394 226 372 192 C368 220 356 238 340 250 C346 196 330 130 268 34 C238 100 196 140 188 214 C176 196 160 180 146 150 C118 196 96 258 96 326 C96 416 158 480 256 480 Z";
export const INNER =
  "M258 452 C312 452 346 416 346 366 C346 318 314 292 290 240 C284 268 262 288 238 304 C206 326 190 346 190 380 C190 424 216 452 258 452 Z";

// each app's colours: the outer flame's bottom, middle and tips, the inner flame's base and
// top, and the studio behind the app icon
export const PALETTES = {
  // flint local
  aurora: { bottom: "#22d3c5", middle: "#3b82ff", tips: "#4338ff", innerBase: "#b6ef4a", innerTop: "#f4ffd0" },
  // flint, with account sync
  violet: { bottom: "#4ad6ff", middle: "#6a5cff", tips: "#8b3dff", innerBase: "#b8f7ff", innerTop: "#ffffff" },
};

export const STUDIOS = {
  navy: ["#22355c", "#0d1730", "#050912"],
  midnight: ["#1c1d22", "#0b0b0d", "#000000"],
  paper: ["#ffffff", "#eef2fb", "#ccd6ea"],
  amber: ["#ffd27a", "#f59e2b", "#b45309"],
};

// world units per drawing pixel: the flame is about 2.2 units tall
const UNIT = 1.4 / 256;
const OUTER_HEIGHT = 46;
const OUTER_RADIUS = 70;
const INNER_HEIGHT = 30;
const INNER_RADIUS = 46;

// the path's outline as a dense polyline, a spatial index of its segments, and an inside test
function outline(d) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.setAttribute("d", d);
  const length = svg.getTotalLength();
  const count = 900;
  const points = [];
  for (let i = 0; i < count; i++) {
    const p = svg.getPointAtLength((i / count) * length);
    points.push([p.x, p.y]);
  }
  const cell = 16;
  const buckets = new Map();
  const key = (i, j) => i * 1000 + j;
  points.forEach(([ax, ay], s) => {
    const [bx, by] = points[(s + 1) % count];
    for (let i = Math.floor(Math.min(ax, bx) / cell); i <= Math.floor(Math.max(ax, bx) / cell); i++) {
      for (let j = Math.floor(Math.min(ay, by) / cell); j <= Math.floor(Math.max(ay, by) / cell); j++) {
        const k = key(i, j);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(s);
      }
    }
  });
  const ctx = document.createElement("canvas").getContext("2d");
  const path = new Path2D(d);
  return { points, buckets, cell, key, inside: (x, y) => ctx.isPointInPath(path, x, y) };
}

// signed distance (positive inside) to the outline, and the nearest point on it
function field(shape, x, y) {
  const { points, buckets, cell, key } = shape;
  const ci = Math.floor(x / cell);
  const cj = Math.floor(y / cell);
  let best = Infinity;
  let near = points[0];
  for (let ring = 0; ring < 40; ring++) {
    // nothing in a further ring can beat the best found so far
    if (best !== Infinity && (ring - 1) * cell > Math.sqrt(best)) break;
    for (let i = ci - ring; i <= ci + ring; i++) {
      for (let j = cj - ring; j <= cj + ring; j++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue;
        const list = buckets.get(key(i, j));
        if (!list) continue;
        for (const s of list) {
          const [ax, ay] = points[s];
          const [bx, by] = points[(s + 1) % points.length];
          const dx = bx - ax;
          const dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
          const px = ax + dx * t;
          const py = ay + dy * t;
          const dd = (x - px) ** 2 + (y - py) ** 2;
          if (dd < best) {
            best = dd;
            near = [px, py];
          }
        }
      }
    }
  }
  const d = Math.sqrt(best);
  return { d: shape.inside(x, y) ? d : -d, near };
}

// a pillow: a round edge of radius r rising to height h, with a gentle dome inside
function pillow(d, h, r, dmax) {
  if (d <= 0) return 0;
  const e = Math.min(d / r, 1);
  return h * Math.sqrt(1 - (1 - e) ** 2) * (0.78 + 0.22 * Math.min(d / dmax, 1));
}

function slope(d, h, r, dmax) {
  if (d <= 0) return 60;
  const e = Math.min(d / r, 1);
  if (e >= 1) return (h * 0.22) / dmax;
  const root = Math.sqrt(Math.max(1 - (1 - e) ** 2, 1e-4));
  return Math.min(60, ((h * (1 - e)) / (r * root)) * (0.78 + 0.22 * Math.min(d / dmax, 1)));
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// one inflated surface, front and (optionally) back, with exact normals and per-vertex colour
function inflate(THREE, d, { grid, height, radius, back = 0.55, base = () => 0, color }) {
  const shape = outline(d);
  const step = 512 / grid;
  const n = grid + 1;
  const cells = [];
  let dmax = 1;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = j * step;
      const f = field(shape, x, y);
      cells.push({ x, y, ...f });
      dmax = Math.max(dmax, f.d);
    }
  }
  const at = (i, j) => cells[j * n + i];
  // keep the inside, and the outside ring next to it, which snaps onto the outline
  const keep = new Uint8Array(cells.length);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (at(i, j).d <= 0) continue;
      for (let b = -1; b <= 1; b++) {
        for (let a = -1; a <= 1; a++) {
          const ii = i + a;
          const jj = j + b;
          if (ii >= 0 && jj >= 0 && ii < n && jj < n) keep[jj * n + ii] = 1;
        }
      }
    }
  }
  const pos = [];
  const nor = [];
  const col = [];
  const index = [];
  const rim = [];
  const c = new THREE.Color();
  for (const side of back ? [1, -back] : [1]) {
    const map = new Int32Array(cells.length).fill(-1);
    let count = pos.length / 3;
    cells.forEach((cell, k) => {
      if (!keep[k]) return;
      const [px, py] = cell.d > 0 ? [cell.x, cell.y] : cell.near;
      const h = pillow(cell.d, height, radius, dmax);
      pos.push((px - 256) * UNIT, -(py - 256) * UNIT, base(px, py) + side * h * UNIT);
      color(px, py, Math.max(cell.d, 0) / dmax, c);
      col.push(c.r, c.g, c.b);
      // the exact normal: steep at the rim, facing out along the path
      const vx = cell.x - cell.near[0];
      const vy = cell.y - cell.near[1];
      const len = Math.hypot(vx, vy) || 1;
      const inward = cell.d > 0 ? [vx / len, vy / len] : [-vx / len, -vy / len];
      const rise = (side > 0 ? 1 : back) * slope(cell.d, height, radius, dmax);
      const gx = inward[0] * rise;
      const gy = -inward[1] * rise;
      const nl = Math.hypot(gx, gy, 1);
      nor.push(-gx / nl, -gy / nl, (side > 0 ? 1 : -1) / nl);
      rim.push(cell.d <= step * 0.75 ? 1 : 0);
      map[k] = count++;
    });
    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const a = map[j * n + i];
        const b = map[j * n + i + 1];
        const cc = map[(j + 1) * n + i];
        const dd = map[(j + 1) * n + i + 1];
        if (a < 0 || b < 0 || cc < 0 || dd < 0) continue;
        if (at(i, j).d <= 0 && at(i + 1, j).d <= 0 && at(i, j + 1).d <= 0 && at(i + 1, j + 1).d <= 0) continue;
        if (side > 0) index.push(a, cc, b, b, cc, dd);
        else index.push(a, b, cc, b, dd, cc);
      }
    }
  }
  // relax the rim vertices along the outline, so the silhouette is smooth
  const neighbours = new Map();
  for (let k = 0; k < index.length; k += 3) {
    const tri = [index[k], index[k + 1], index[k + 2]];
    for (const a of tri) {
      for (const b of tri) {
        if (a === b || !rim[a] || !rim[b]) continue;
        if (!neighbours.has(a)) neighbours.set(a, new Set());
        neighbours.get(a).add(b);
      }
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const next = pos.slice();
    for (const [v, ns] of neighbours) {
      let x = pos[v * 3];
      let y = pos[v * 3 + 1];
      for (const u of ns) {
        x += pos[u * 3];
        y += pos[u * 3 + 1];
      }
      next[v * 3] = x / (ns.size + 1);
      next[v * 3 + 1] = y / (ns.size + 1);
    }
    for (let i = 0; i < pos.length; i++) pos[i] = next[i];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  return { geometry: g, shape, dmax };
}

// glossy toy plastic that glows in its own vertex colours; "glow" can be changed live
function glossy(THREE, glow) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.3,
    iridescenceIOR: 1.3,
    emissive: "#ffffff",
    emissiveIntensity: glow,
    specularIntensity: 1,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;",
    );
  };
  return m;
}

function colours(THREE, p) {
  const mix = (out, a, b, t) => out.set(a).lerp(new THREE.Color(b), t);
  return {
    outer: (x, y, inset, out) => {
      // low in the body to high in the tips
      const t = 1 - (y - 30) / 450;
      mix(out, p.bottom, p.middle, smooth(0.15, 0.62, t));
      out.lerp(new THREE.Color(p.tips), smooth(0.7, 1, t) * 0.8);
      out.lerp(new THREE.Color("#ffffff"), smooth(0.4, 1, inset) * 0.08);
    },
    inner: (x, y, inset, out) => {
      const t = 1 - (y - 240) / 212;
      mix(out, p.innerBase, p.innerTop, smooth(0.3, 1, t) * 0.7);
    },
  };
}

// the flame, centred on its own optical middle. "grid" trades detail for build time: 420 for
// the app icon renders, about 240 for the website.
export function buildFlame(THREE, { palette = "aurora", grid = 420 } = {}) {
  const paint = colours(THREE, PALETTES[palette]);
  const group = new THREE.Group();
  const outer = inflate(THREE, OUTER, { grid, height: OUTER_HEIGHT, radius: OUTER_RADIUS, color: paint.outer });
  const outerMaterial = glossy(THREE, 0.32);
  group.add(new THREE.Mesh(outer.geometry, outerMaterial));
  // the inner flame sits on the outer flame's surface and puffs up from it
  const surface = (x, y) => pillow(field(outer.shape, x, y).d, OUTER_HEIGHT, OUTER_RADIUS, outer.dmax) * UNIT + 0.006;
  const inner = inflate(THREE, INNER, { grid, height: INNER_HEIGHT, radius: INNER_RADIUS, back: 0, base: surface, color: paint.inner });
  const innerMaterial = glossy(THREE, 0.45);
  group.add(new THREE.Mesh(inner.geometry, innerMaterial));
  // lift the flame so its mass sits in the middle of the frame, not its bounds: the tips are thin
  group.position.y = 0.2;
  const pose = new THREE.Group();
  pose.add(group);
  pose.rotation.set(0.12, -0.32, 0);
  pose.userData.materials = [outerMaterial, innerMaterial];
  return pose;
}

// a studio for the flame: soft boxes for long clean highlights, and two lights
export function lightFlame(THREE, scene, renderer, intensity = 2.2) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.background = new THREE.Color("#141518");
  const box = (w, h, x, y, z, level) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(level, level, level), side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  box(5, 1.6, -3.5, 4.5, 4, 7);
  box(0.5, 7, 5.5, 0.5, 2.5, 6);
  box(0.4, 7, -5.5, 0, 1, 3);
  box(7, 0.6, 0, -4.5, 2.5, 2.5);
  box(3, 3, 0, 2, -6, 3);
  box(0.4, 5, 2, 4, 5, 4);
  scene.environment = pmrem.fromScene(room, 0.01).texture;
  scene.environmentIntensity = intensity;
  const key = new THREE.DirectionalLight("#ffffff", 1.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffffff", 2.4);
  rim.position.set(4, 2, -3);
  scene.add(rim);
}
