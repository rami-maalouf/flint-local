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

// points evenly spaced along a path drawn with absolute M, C and Z commands, as these are
function samplePath(d, count) {
  const nums = d.match(/-?[\d.]+/g).map(Number);
  const [sx, sy] = nums;
  const fine = [[sx, sy]];
  for (let k = 2; k + 5 < nums.length; k += 6) {
    const [x0, y0] = fine[fine.length - 1];
    const [x1, y1, x2, y2, x3, y3] = nums.slice(k, k + 6);
    for (let i = 1; i <= 120; i++) {
      const t = i / 120;
      const u = 1 - t;
      fine.push([
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
  }
  const lengths = [0];
  for (let i = 1; i < fine.length; i++) lengths.push(lengths[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
  const total = lengths[lengths.length - 1];
  const out = [];
  let i = 1;
  for (let k = 0; k < count; k++) {
    const want = (k / count) * total;
    while (lengths[i] < want) i++;
    const t = (want - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    out.push([fine[i - 1][0] + (fine[i][0] - fine[i - 1][0]) * t, fine[i - 1][1] + (fine[i][1] - fine[i - 1][1]) * t]);
  }
  return out;
}

// the path's outline as a dense polyline, a spatial index of its segments, and an inside test
function outline(d) {
  // round each sharp tip by a pixel or two, so the light does not fan out from a point
  let points = samplePath(d, 900);
  for (let pass = 0; pass < 4; pass++) {
    points = points.map(([x, y], i) => {
      const [ax, ay] = points[(i + points.length - 1) % points.length];
      const [bx, by] = points[(i + 1) % points.length];
      return [(ax + 2 * x + bx) / 4, (ay + 2 * y + by) / 4];
    });
  }
  const count = points.length;
  // a flat grid of buckets, each listing the outline segments that cross it
  const cell = 16;
  const side = Math.ceil(512 / cell) + 1;
  const buckets = Array.from({ length: side * side }, () => []);
  const clampCell = (v) => Math.max(0, Math.min(side - 1, Math.floor(v / cell)));
  points.forEach(([ax, ay], s) => {
    const [bx, by] = points[(s + 1) % count];
    for (let i = clampCell(Math.min(ax, bx)); i <= clampCell(Math.max(ax, bx)); i++) {
      for (let j = clampCell(Math.min(ay, by)); j <= clampCell(Math.max(ay, by)); j++) buckets[j * side + i].push(s);
    }
  });
  // which grid points are inside: the path filled once into a canvas with one pixel per point
  const insideGrid = (grid) => {
    const n = grid + 1;
    const step = 512 / grid;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(1 / step, 0, 0, 1 / step, 0.5, 0.5);
    ctx.fill(new Path2D(d));
    const alpha = ctx.getImageData(0, 0, n, n).data;
    const mask = new Uint8Array(n * n);
    for (let k = 0; k < mask.length; k++) mask[k] = alpha[k * 4 + 3] > 127 ? 1 : 0;
    return mask;
  };
  return { points, buckets, cell, side, clampCell, insideGrid };
}

// signed distance (positive inside) to the outline, and the nearest point on it. "floor" is a
// distance the answer cannot be below (a neighbour's distance less one grid step): rings of
// buckets that lie wholly inside it cannot hold the nearest segment and are skipped.
function field(shape, x, y, inside, floor = 0) {
  const { points, buckets, cell, side, clampCell } = shape;
  const ci = clampCell(x);
  const cj = clampCell(y);
  let best = Infinity;
  let near = points[0];
  const visit = (i, j) => {
    if (i < 0 || j < 0 || i >= side || j >= side) return;
    for (const s of buckets[j * side + i]) {
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
  };
  const first = Math.max(0, Math.floor(floor / (cell * Math.SQRT2)) - 1);
  for (let ring = first; ring < side; ring++) {
    // nothing in a further ring can beat the best found so far
    if (best !== Infinity && (ring - 1) * cell > Math.sqrt(best)) break;
    if (ring === 0) {
      visit(ci, cj);
      continue;
    }
    for (let k = -ring; k <= ring; k++) {
      visit(ci + k, cj - ring);
      visit(ci + k, cj + ring);
    }
    for (let k = -ring + 1; k <= ring - 1; k++) {
      visit(ci - ring, cj + k);
      visit(ci + ring, cj + k);
    }
  }
  const d = Math.sqrt(best);
  return { d: inside ? d : -d, near };
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

// one inflated surface, front and (optionally) back, with exact normals and per-vertex colour.
// it is one height field, sampled two ways that overlap: a band that follows the outline, so
// the steep rim and the silhouette are smooth, and a grid for the gentle middle.
function inflate(THREE, d, { grid, height, radius, back = 0.55, base = () => 0, color }) {
  const shape = outline(d);
  const step = 512 / grid;
  const n = grid + 1;
  const inside = shape.insideGrid(grid);
  // the grid measures only points inside the shape
  const cells = [];
  let dmax = 1;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = j * step;
      if (!inside[j * n + i]) {
        cells.push({ x, y, d: -1, near: [x, y] });
        continue;
      }
      // the point to the left bounds this one's distance, when it was measured
      const prev = i > 0 && cells[cells.length - 1].d > 0 ? cells[cells.length - 1] : null;
      const f = field(shape, x, y, true, prev ? prev.d - step : 0);
      cells.push({ x, y, ...f });
      dmax = Math.max(dmax, f.d);
    }
  }

  // the band: rows stepping in from the outline, closer together near the rim
  const reach = radius + 3 * step;
  const rows = 28;
  const pts = shape.points;
  const count = pts.length;
  let area = 0;
  for (let s = 0; s < count; s++) {
    const [ax, ay] = pts[s];
    const [bx, by] = pts[(s + 1) % count];
    area += ax * by - bx * ay;
  }
  const turn = area > 0 ? 1 : -1;
  // each column steps in along the outline's inward normal, but only as far as the middle of
  // the shape: past it, another part of the outline is nearer. columns from both sides meet
  // there, just overlapping, so thin tips and notches close without cracks.
  const insideAt = (x, y) => {
    const i = Math.round(x / step);
    const j = Math.round(y / step);
    return i >= 0 && j >= 0 && i < n && j < n && inside[j * n + i] === 1;
  };
  const columns = pts.map(([px, py], s) => {
    const [ax, ay] = pts[(s + count - 1) % count];
    const [bx, by] = pts[(s + 1) % count];
    const tx = bx - ax;
    const ty = by - ay;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = (-turn * ty) / tl;
    const ny = (turn * tx) / tl;
    const owns = (depth) => {
      const x = px + nx * depth;
      const y = py + ny * depth;
      if (!insideAt(x, y)) return false;
      const f = field(shape, x, y, true);
      return Math.hypot(f.near[0] - px, f.near[1] - py) < 1.5 + depth * 0.02;
    };
    let lo = 0;
    let hi = reach;
    if (!owns(hi)) {
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) / 2;
        if (owns(mid)) lo = mid;
        else hi = mid;
      }
    } else lo = reach;
    return { px, py, nx, ny, edge: [tx / tl, ty / tl], depth: Math.min(reach, lo + 2.5) };
  });
  const band = [];
  for (let k = 0; k <= rows; k++) {
    const t = (k / rows) ** 1.7;
    for (const col of columns) {
      if (k === 0) {
        band.push({ x: col.px, y: col.py, d: 0, near: [col.px, col.py], edge: col.edge });
        continue;
      }
      const x = col.px + col.nx * col.depth * t;
      const y = col.py + col.ny * col.depth * t;
      band.push({ x, y, ...field(shape, x, y, true) });
    }
  }

  // which grid points the band already covers; the grid fills the rest of the inside
  const covered = new Uint8Array(n * n);
  const cover = (p, q, r) => {
    const minX = Math.max(0, Math.floor(Math.min(p.x, q.x, r.x) / step));
    const maxX = Math.min(n - 1, Math.ceil(Math.max(p.x, q.x, r.x) / step));
    const minY = Math.max(0, Math.floor(Math.min(p.y, q.y, r.y) / step));
    const maxY = Math.min(n - 1, Math.ceil(Math.max(p.y, q.y, r.y) / step));
    const cross = (a, b, x, y) => (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    for (let j = minY; j <= maxY; j++) {
      for (let i = minX; i <= maxX; i++) {
        const x = i * step;
        const y = j * step;
        const c1 = cross(p, q, x, y);
        const c2 = cross(q, r, x, y);
        const c3 = cross(r, p, x, y);
        if ((c1 >= 0 && c2 >= 0 && c3 >= 0) || (c1 <= 0 && c2 <= 0 && c3 <= 0)) covered[j * n + i] = 1;
      }
    }
  };
  for (let k = 0; k < rows; k++) {
    for (let s = 0; s < count; s++) {
      const a = band[k * count + s];
      const b = band[k * count + ((s + 1) % count)];
      const cc = band[(k + 1) * count + s];
      const dd = band[(k + 1) * count + ((s + 1) % count)];
      cover(a, b, cc);
      cover(b, dd, cc);
    }
  }

  const pos = [];
  const nor = [];
  const col = [];
  const index = [];
  const c = new THREE.Color();
  const vertex = (p, side) => {
    const h = pillow(p.d, height, radius, dmax);
    pos.push((p.x - 256) * UNIT, -(p.y - 256) * UNIT, base(p.x, p.y) + side * h * UNIT);
    color(p.x, p.y, Math.max(p.d, 0) / dmax, c);
    col.push(c.r, c.g, c.b);
    // the exact normal: steep at the rim, facing out along the path
    let inward;
    if (p.edge) inward = [-turn * p.edge[1], turn * p.edge[0]];
    else {
      const vx = p.x - p.near[0];
      const vy = p.y - p.near[1];
      const len = Math.hypot(vx, vy) || 1;
      inward = [vx / len, vy / len];
    }
    const rise = (side > 0 ? 1 : back) * slope(p.d, height, radius, dmax);
    const gx = inward[0] * rise;
    const gy = -inward[1] * rise;
    const nl = Math.hypot(gx, gy, 1);
    nor.push(-gx / nl, -gy / nl, (side > 0 ? 1 : -1) / nl);
    return pos.length / 3 - 1;
  };

  let frontCount = 0;
  for (const side of back ? [1, -back] : [1]) {
    const flip = (a, b, cc) => (side > 0 ? index.push(a, b, cc) : index.push(a, cc, b));
    // the band, row by row around the outline
    const bandStart = pos.length / 3;
    for (const p of band) vertex(p, side);
    for (let k = 0; k < rows; k++) {
      for (let s = 0; s < count; s++) {
        const a = bandStart + k * count + s;
        const b = bandStart + k * count + ((s + 1) % count);
        const cc = a + count;
        const dd = b + count;
        if (turn > 0) {
          flip(a, cc, b);
          flip(b, cc, dd);
        } else {
          flip(a, b, cc);
          flip(b, dd, cc);
        }
      }
    }
    // the middle, and any gap the band leaves: grid squares wholly inside, with a corner the
    // band does not cover. they overlap the band's inner edge, on the same surface.
    const map = new Int32Array(cells.length).fill(-1);
    cells.forEach((cell, k) => {
      if (cell.d > 0) map[k] = vertex(cell, side);
    });
    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const k = [j * n + i, j * n + i + 1, (j + 1) * n + i, (j + 1) * n + i + 1];
        const [a, b, cc, dd] = k.map((q) => map[q]);
        if (a < 0 || b < 0 || cc < 0 || dd < 0) continue;
        if (k.every((q) => covered[q])) continue;
        flip(a, cc, b);
        flip(b, cc, dd);
      }
    }
    if (side > 0) frontCount = index.length;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  // the front and the back meet at the rim; drawn as two groups so the back can sit a hair
  // behind in depth, and never speckles through the front along the edge
  g.addGroup(0, frontCount, 0);
  if (index.length > frontCount) g.addGroup(frontCount, index.length - frontCount, 1);
  return { geometry: g, shape, dmax, cells, n, step };
}

// glossy toy plastic that glows in its own vertex colours; "glow" can be changed live. "behind"
// pushes the surface back a little in depth, for the back of an inflated shape.
function glossy(THREE, glow, behind = false) {
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
    polygonOffset: behind,
    polygonOffsetFactor: behind ? 2 : 0,
    polygonOffsetUnits: behind ? 2 : 0,
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
  const outerMaterials = [glossy(THREE, 0.32), glossy(THREE, 0.32, true)];
  group.add(new THREE.Mesh(outer.geometry, outerMaterials));
  // the inner flame sits on the outer flame's surface and puffs up from it
  const surface = (x, y) => {
    const cell = outer.cells[Math.round(y / outer.step) * outer.n + Math.round(x / outer.step)];
    return pillow(cell.d, OUTER_HEIGHT, OUTER_RADIUS, outer.dmax) * UNIT + 0.006;
  };
  const inner = inflate(THREE, INNER, { grid, height: INNER_HEIGHT, radius: INNER_RADIUS, back: 0, base: surface, color: paint.inner });
  const innerMaterials = [glossy(THREE, 0.45)];
  group.add(new THREE.Mesh(inner.geometry, innerMaterials));
  // lift the flame so its mass sits in the middle of the frame, not its bounds: the tips are thin
  group.position.y = 0.2;
  const pose = new THREE.Group();
  pose.add(group);
  pose.rotation.set(0.12, -0.32, 0);
  // the website changes the glow live: the outer flame's materials, then the inner flame's
  pose.userData.outer = outerMaterials;
  pose.userData.inner = innerMaterials;
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
