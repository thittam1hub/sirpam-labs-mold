// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import * as THREE from 'three';
import type { Axis } from '../types';
import type { MoldEnvelope } from './moldBox';

/**
 * Shared outward-offset helper for "form fit" shells and skin molds.
 *
 * Why this module exists: siliconeMold.ts grew a private `offsetOutward`
 * for its skin/glove mold path, and the form-fit shell feature (rigid +
 * silicone block molds whose outer wall hugs the model instead of being a
 * box) needs the exact same operation. Keeping it here avoids a copy-paste
 * fork of a numerically delicate helper.
 */

/**
 * Grow a manifold outward by `t` in every direction.
 *
 * True offsetting is a Minkowski sum with a sphere; that's exact but its
 * cost scales with (triangles × sphere facets), so it is only attempted on
 * moderate meshes. For heavy meshes we fall back to a uniform scale about
 * the bbox centre, which is a well-behaved approximation for the blobby
 * organic shapes form-fit shells and skin molds are normally used on.
 */
export function offsetOutward(wasm: any, m: any, t: number, bbox: THREE.Box3): any {
  const { Manifold } = wasm;
  let triCount = Infinity;
  try {
    triCount = m.numTri();
  } catch {
    /* older builds: leave as Infinity so we take the cheap path */
  }

  if (t > 0 && triCount <= 20000) {
    try {
      return m.minkowskiSum(Manifold.sphere(t, 12));
    } catch (e) {
      console.warn('Minkowski offset failed, falling back to scaled offset', e);
    }
  }

  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const minExtent = Math.max(Math.min(size.x, size.y, size.z), 1e-6);
  const k = 1 + (2 * t) / minExtent;
  return m
    .translate([-center.x, -center.y, -center.z])
    .scale([k, k, k])
    .translate([center.x, center.y, center.z]);
}

/**
 * Build a MoldEnvelope from a manifold's own bounding box.
 *
 * Form-fit shells have no analytic silhouette (rect / cylinder / rounded) —
 * the outer wall IS the offset model. Downstream code (pin placement,
 * channel placement, plane sizing) only ever reasons about the envelope's
 * AABB fields, so we report `shape: 'rect'` with moldMin/moldSize set to
 * the offset solid's actual bounds. Nothing should call
 * `createMoldBoxManifold` on the result — the shell solid already exists.
 */
export function envelopeAroundManifold(
  m: any,
  axis: Axis,
  wallThickness: number,
): MoldEnvelope {
  const bb = m.boundingBox();
  return {
    shape: 'rect',
    axis,
    wallThickness,
    moldMin: new THREE.Vector3(bb.min[0], bb.min[1], bb.min[2]),
    moldSize: new THREE.Vector3(
      bb.max[0] - bb.min[0],
      bb.max[1] - bb.min[1],
      bb.max[2] - bb.min[2],
    ),
  };
}
