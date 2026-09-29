import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from "three-bvh-csg";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type MoldOptions = {
  wall: number; // mm padding around model
  splitRatio: number; // 0..1 parting height
  keys: boolean;
  keyRadius: number;
  sprue: boolean;
  sprueRadius: number;
};

function clean(g: THREE.BufferGeometry) {
  let geo = g.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== "position") geo.deleteAttribute(k);
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  return geo;
}

function brush(g: THREE.BufferGeometry, pos?: THREE.Vector3) {
  const b = new Brush(clean(g));
  if (pos) b.position.copy(pos);
  b.updateMatrixWorld();
  return b;
}

/** Normalises a model: centred on X/Y, sitting on origin, returns geometry + bbox. */
export function prepareModel(g: THREE.BufferGeometry) {
  const geo = clean(g);
  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox!.getCenter(c);
  geo.translate(-c.x, -c.y, -c.z);
  geo.computeBoundingBox();
  return geo;
}

export function buildMold(model: THREE.BufferGeometry, o: MoldOptions) {
  const ev = new Evaluator();
  ev.attributes = ["position", "normal"];
  ev.useGroups = false;

  const bb = model.boundingBox!;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const W = size.x + o.wall * 2;
  const D = size.z + o.wall * 2;
  const H = size.y + o.wall * 2;
  const bottomY = -H / 2;
  const splitY = bottomY + H * o.splitRatio;

  const block = brush(new THREE.BoxGeometry(W, H, D));
  const modelB = brush(model);
  const cavity = ev.evaluate(block, modelB, SUBTRACTION);

  const lowH = splitY - bottomY;
  const highH = H / 2 - splitY;
  const lowBox = brush(new THREE.BoxGeometry(W + 2, lowH, D + 2), new THREE.Vector3(0, bottomY + lowH / 2, 0));
  const highBox = brush(new THREE.BoxGeometry(W + 2, highH, D + 2), new THREE.Vector3(0, splitY + highH / 2, 0));

  let bottom = ev.evaluate(cavity, lowBox, INTERSECTION);
  let top = ev.evaluate(cavity, highBox, INTERSECTION);

  if (o.keys) {
    const inset = o.wall / 2;
    const corners = [
      [-W / 2 + inset, -D / 2 + inset],
      [W / 2 - inset, -D / 2 + inset],
      [W / 2 - inset, D / 2 - inset],
      [-W / 2 + inset, D / 2 - inset],
    ];
    for (const [x, z] of corners) {
      const sphere = new THREE.SphereGeometry(o.keyRadius, 20, 14);
      bottom = ev.evaluate(bottom, brush(sphere, new THREE.Vector3(x, splitY, z)), ADDITION);
      const hole = new THREE.SphereGeometry(o.keyRadius * 1.05, 20, 14);
      top = ev.evaluate(top, brush(hole, new THREE.Vector3(x, splitY, z)), SUBTRACTION);
    }
  }

  if (o.sprue) {
    const len = H / 2 - bb.max.y + 2 + size.y * 0.1;
    const cyl = new THREE.CylinderGeometry(o.sprueRadius, o.sprueRadius * 1.6, len, 24);
    const y = H / 2 - len / 2 + 1;
    top = ev.evaluate(top, brush(cyl, new THREE.Vector3(0, y, 0)), SUBTRACTION);
  }

  return {
    top: top.geometry,
    bottom: bottom.geometry,
    dims: { W, H, D, splitY },
  };
}
