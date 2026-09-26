import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { getManifold, geometryToManifold, manifoldToGeometry } from './manifoldBridge';

/**
 * Model-prep tools that run on the main thread (they change the master model,
 * not the mold): emboss/engrave, big-prop bed splitter, wax tree builder and
 * dental/medical model base. All return new geometry and never mutate input.
 */

export type Side = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
const SIDE_VEC: Record<Side, THREE.Vector3> = {
  '+x': new THREE.Vector3(1, 0, 0), '-x': new THREE.Vector3(-1, 0, 0),
  '+y': new THREE.Vector3(0, 1, 0), '-y': new THREE.Vector3(0, -1, 0),
  '+z': new THREE.Vector3(0, 0, 1), '-z': new THREE.Vector3(0, 0, -1),
};

let fontPromise: Promise<Font> | null = null;
function loadFont(): Promise<Font> {
  fontPromise ??= new Promise((res, rej) => new FontLoader().load('/fonts/helvetiker_bold.typeface.json', res, undefined, rej));
  return fontPromise;
}

function finish(m: any): THREE.BufferGeometry {
  const g = manifoldToGeometry(m);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

/* ───────────── Emboss / engrave ───────────── */

export async function embossModel(model: THREE.BufferGeometry, o: {
  text?: string; svg?: string | undefined; side: Side; heightMm: number; depthMm: number; mode: 'raise' | 'engrave';
}): Promise<THREE.BufferGeometry> {
  let shapes: THREE.Shape[] = [];
  if (o.svg) {
    const data = new SVGLoader().parse(o.svg);
    for (const p of data.paths) shapes.push(...SVGLoader.createShapes(p));
    // SVG y points down.
  } else if (o.text?.trim()) {
    const font = await loadFont();
    shapes = font.generateShapes(o.text.trim(), 10);
  }
  if (!shapes.length) throw new Error('Nothing to emboss — type some text or choose an SVG file.');

  const embed = Math.max(1, o.depthMm);
  const total = o.depthMm + embed;
  const shapeGeo = new THREE.ExtrudeGeometry(shapes, { depth: total, bevelEnabled: false, curveSegments: 6 });
  if (o.svg) shapeGeo.scale(1, -1, 1);
  shapeGeo.computeBoundingBox();
  const sb = shapeGeo.boundingBox!;
  const w = sb.max.x - sb.min.x, h = sb.max.y - sb.min.y;
  const k = o.heightMm / Math.max(h, 1e-6);
  shapeGeo.translate(-(sb.min.x + w / 2), -(sb.min.y + h / 2), -sb.min.z);
  shapeGeo.scale(k, k, 1);
  if (o.svg) {
    // Flipping Y inverted the winding; flip Z too to restore outward normals.
    shapeGeo.scale(1, 1, -1); shapeGeo.translate(0, 0, total);
  }

  // Find the surface point on the chosen side, through the model centre.
  model.computeBoundingBox();
  const bb = model.boundingBox!;
  const center = bb.getCenter(new THREE.Vector3());
  const d = SIDE_VEC[o.side];
  const far = center.clone().addScaledVector(d, bb.getSize(new THREE.Vector3()).length() + 10);
  const mesh = new THREE.Mesh(model, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const hit = new THREE.Raycaster(far, d.clone().negate()).intersectObject(mesh, false)[0];
  const surface = hit ? hit.point : center.clone().addScaledVector(d, Math.abs(bb.max.clone().sub(center).dot(d)));

  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  shapeGeo.applyQuaternion(q);
  const start = o.mode === 'raise' ? -embed : -o.depthMm;
  shapeGeo.translate(surface.x + d.x * start, surface.y + d.y * start, surface.z + d.z * start);

  const wasm = await getManifold();
  const m = geometryToManifold(wasm, model);
  const s = geometryToManifold(wasm, shapeGeo);
  const out = o.mode === 'raise' ? m.add(s) : m.subtract(s);
  if (out.isEmpty()) throw new Error('The logo did not touch the model — try another side.');
  return finish(out);
}

/* ───────────── Big-prop bed splitter ───────────── */

export interface SplitResult { pieces: THREE.BufferGeometry[]; dowels: number; grid: [number, number, number] }

export async function splitForBed(model: THREE.BufferGeometry, o: {
  bed: { x: number; y: number; z: number }; dowelDiameterMm: number; dowelDepthMm: number;
}): Promise<SplitResult> {
  const wasm = await getManifold();
  let m = geometryToManifold(wasm, model);
  const bb = m.boundingBox();
  const mn = bb.min as number[], mx = bb.max as number[];
  const bedArr = [o.bed.x, o.bed.y, o.bed.z].map(v => v - 10);
  const grid = [0, 1, 2].map(i => Math.max(1, Math.ceil((mx[i]! - mn[i]!) / bedArr[i]!))) as [number, number, number];
  const r = o.dowelDiameterMm / 2 + 0.15;
  const len = o.dowelDepthMm * 2;
  const rot: Array<[number, number, number]> = [[0, 90, 0], [90, 0, 0], [0, 0, 0]];
  let dowels = 0;

  // Drill dowel holes across every cut plane before cutting.
  for (let ax = 0; ax < 3; ax++) {
    for (let c = 1; c < grid[ax]!; c++) {
      const at = mn[ax]! + ((mx[ax]! - mn[ax]!) * c) / grid[ax]!;
      const [la, lb] = [0, 1, 2].filter(i => i !== ax) as [number, number];
      const cands: Array<[number, number]> = [];
      for (let i = 1; i <= 4; i++) for (let j = 1; j <= 4; j++) {
        cands.push([mn[la]! + ((mx[la]! - mn[la]!) * i) / 5, mn[lb]! + ((mx[lb]! - mn[lb]!) * j) / 5]);
      }
      const ok: Array<[number, number]> = [];
      for (const [a, b] of cands) {
        const pos = [0, 0, 0]; pos[ax] = at; pos[la] = a; pos[lb] = b;
        const probe = wasm.Manifold.cylinder(len, r + 1.2, r + 1.2, 24, true).rotate(rot[ax]!).translate(pos as [number, number, number]);
        const full = probe.volume();
        const inside = m.intersect(probe).volume();
        if (inside > full * 0.97) ok.push([a, b]);
      }
      // Keep up to 3, spread apart.
      const pick: Array<[number, number]> = [];
      for (const p of ok) {
        if (pick.length >= 3) break;
        if (pick.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 6 * r)) pick.push(p);
      }
      for (const [a, b] of pick) {
        const pos = [0, 0, 0]; pos[ax] = at; pos[la] = a; pos[lb] = b;
        m = m.subtract(wasm.Manifold.cylinder(len, r, r, 24, true).rotate(rot[ax]!).translate(pos as [number, number, number]));
        dowels++;
      }
    }
  }

  let parts: any[] = [m];
  for (let ax = 0; ax < 3; ax++) {
    for (let c = 1; c < grid[ax]!; c++) {
      const at = mn[ax]! + ((mx[ax]! - mn[ax]!) * c) / grid[ax]!;
      const n = [0, 0, 0]; n[ax] = 1;
      const next: any[] = [];
      for (const p of parts) {
        const [a, b] = p.splitByPlane(n as [number, number, number], at);
        if (!a.isEmpty()) next.push(a);
        if (!b.isEmpty()) next.push(b);
      }
      parts = next;
    }
  }
  const pieces: THREE.BufferGeometry[] = [];
  for (const p of parts) for (const d of p.decompose()) if (!d.isEmpty()) pieces.push(finish(d));
  return { pieces, dowels, grid };
}

/* ───────────── Wax tree builder (lost-wax casting) ───────────── */

export async function buildWaxTree(model: THREE.BufferGeometry, o: {
  count: number; sprueDiameterMm: number; gateDiameterMm: number; gapMm: number;
}): Promise<THREE.BufferGeometry> {
  const wasm = await getManifold();
  const part = geometryToManifold(wasm, model);
  const bb = part.boundingBox();
  const mn = bb.min as number[], mx = bb.max as number[];
  const cx = (mn[0]! + mx[0]!) / 2, cy = (mn[1]! + mx[1]!) / 2, cz = (mn[2]! + mx[2]!) / 2;
  const centered = part.translate([-cx, -cy, -cz]);
  const halfXY = Math.max(mx[0]! - mn[0]!, mx[1]! - mn[1]!) / 2;
  const hz = mx[2]! - mn[2]!;
  const perLevel = 4;
  const levels = Math.ceil(o.count / perLevel);
  const sprueR = o.sprueDiameterMm / 2, gateR = o.gateDiameterMm / 2;
  const radius = sprueR + o.gapMm + halfXY;
  const levelH = hz + o.gapMm;
  const base = 15;
  const sprueH = base + levels * levelH + 5;
  const pieces: any[] = [];
  // Sprue + cone button at the bottom (sits in the flask base).
  pieces.push(wasm.Manifold.cylinder(sprueH, sprueR, sprueR, 32, false));
  pieces.push(wasm.Manifold.cylinder(base * 0.6, sprueR * 3, sprueR, 32, false));
  for (let i = 0; i < o.count; i++) {
    const lvl = Math.floor(i / perLevel);
    const ang = ((i % perLevel) / perLevel) * Math.PI * 2 + (lvl % 2 ? Math.PI / 4 : 0);
    const z = base + lvl * levelH + hz / 2;
    const x = Math.cos(ang) * radius, y = Math.sin(ang) * radius;
    pieces.push(centered.rotate([0, 0, THREE.MathUtils.radToDeg(ang)]).translate([x, y, z]));
    const gate = wasm.Manifold.cylinder(radius, gateR * 1.3, gateR, 16, false)
      .rotate([0, 90, 0])
      .rotate([0, 0, THREE.MathUtils.radToDeg(ang)])
      .translate([0, 0, z]);
    pieces.push(gate);
  }
  const tree = wasm.Manifold.union(pieces);
  return finish(tree);
}

/* ───────────── Dental / medical model base ───────────── */

export async function addModelBase(model: THREE.BufferGeometry, o: {
  trimPct: number; baseMm: number; marginMm: number; style: 'solid' | 'ring'; wallMm: number;
}): Promise<THREE.BufferGeometry> {
  const wasm = await getManifold();
  const m = geometryToManifold(wasm, model);
  const bb = m.boundingBox();
  const zmin = (bb.min as number[])[2]!, zmax = (bb.max as number[])[2]!;
  const cut = zmin + ((zmax - zmin) * o.trimPct) / 100;
  const trimmed = o.trimPct > 0 ? m.trimByPlane([0, 0, 1], cut) : m;
  if (trimmed.isEmpty()) throw new Error('Trim height removed the whole model.');
  const sliceZ = (o.trimPct > 0 ? cut : zmin) + 0.2;
  const cs = trimmed.slice(sliceZ);
  const outline = cs.offset(o.marginMm, 'Round');
  let base = wasm.Manifold.extrude(outline, o.baseMm + 0.4).translate([0, 0, sliceZ - 0.2 - o.baseMm]);
  if (o.style === 'ring') {
    const inner = cs.offset(-o.wallMm, 'Round');
    if (!inner.isEmpty()) base = base.subtract(wasm.Manifold.extrude(inner, o.baseMm + 0.2).translate([0, 0, sliceZ - 0.2 - o.baseMm - 0.1]));
  }
  return finish(trimmed.add(base));
}
