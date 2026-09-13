import * as THREE from 'three';

/**
 * Pre-flight mesh validation + auto-repair.
 *
 * Why this exists: Manifold WASM trusts its inputs. Hand it a triangle with a
 * NaN vertex, two coincident points, or a non-finite coordinate and it can
 * crash with cryptic messages like "table index is out of bounds" — the kind
 * of error users can't act on. This module catches the common failure modes
 * BEFORE Manifold sees the geometry, repairs what it can, and reports what it
 * did so the UI can teach the user what to fix upstream (in Blender, Meshmixer,
 * the slicer that exported the STL, etc.).
 *
 * What we DON'T try to repair:
 *   • Non-manifold edges (an edge shared by 3+ triangles). Fixing this would
 *     mean restructuring the user's topology — too invasive, and the fix would
 *     silently change the model's shape. We let Manifold's downstream merge
 *     handle the friendly cases and report the rest as a classified error.
 *   • Holes / non-watertight surfaces. Detecting these reliably needs full
 *     edge-walking; the existing EmptyManifoldError already gives users a
 *     useful hint when this bites.
 *
 * Pure function: no WASM, no THREE side-effects on the input. Returns a fresh
 * geometry plus a structured log of what was repaired.
 */

export interface MeshRepairLog {
  /** Triangles dropped because at least one vertex contained NaN or Infinity. */
  nonFiniteTriangles: number;
  /** Triangles dropped because two or more of their vertices were coincident
   *  (a "sliver" with zero edge length — Manifold can't form a valid face). */
  collapsedTriangles: number;
  /** Triangles dropped because their computed area was below the threshold
   *  (near-zero area — a "needle" sliver that would fold the surface). */
  degenerateTriangles: number;
  /** Open boundary loops (holes) closed to make the mesh watertight. Only
   *  non-zero when hollow-vessel mode runs capOpenBoundaries — validateMesh
   *  itself never caps holes, so it always reports 0 here. Lives on the same
   *  log so the UI can fold "closed N holes" into the one repair toast. */
  closedHoles: number;
  /** Total triangles in the input. */
  inputTriangles: number;
  /** Total triangles in the output (= input − dropped). */
  outputTriangles: number;
}

export interface MeshValidationResult {
  geometry: THREE.BufferGeometry;
  repairs: MeshRepairLog;
}

/**
 * Triangles whose area is below this threshold (in the model's coordinate
 * units squared) are considered degenerate and dropped. Tuned conservatively:
 * this is much smaller than MERGE_TOLERANCE^2 (1e-10) so we only drop true
 * needles, not legitimately small triangles in detailed meshes.
 */
const MIN_TRIANGLE_AREA = 1e-12;

/** Returns true if any of x/y/z is NaN or ±Infinity. */
function isNonFinite(x: number, y: number, z: number): boolean {
  return !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z);
}

/** True if two points are exactly equal in all three coords (post any merging
 *  the input file already did). We don't use a tolerance here — that's
 *  geometryToManifold's job. We're only catching the obvious zero-edge case. */
function pointsEqual(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): boolean {
  return ax === bx && ay === by && az === bz;
}

/** Triangle area via half the magnitude of the cross product of two edges. */
function triangleArea(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): number {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
}

/**
 * Validate and auto-repair a mesh. Always returns a fresh non-indexed
 * BufferGeometry — even when no repairs are needed — so callers don't have
 * to branch on whether the geometry was modified.
 *
 * The returned geometry has `position` only. Normals are not preserved; the
 * downstream pipeline computes them after CSG anyway.
 */
export function validateMesh(geometry: THREE.BufferGeometry): MeshValidationResult {
  // Normalize to non-indexed. We're going to be dropping triangles and
  // rebuilding the position buffer; doing that on indexed geometry would
  // require remapping indices and pruning orphaned vertices — a lot of
  // bookkeeping for no real win. Non-indexed is also what Manifold's bridge
  // expects (see geometryToManifold).
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = nonIndexed.attributes.position.array as
    | Float32Array | Float64Array;
  const inputTriCount = positions.length / 9;

  const repairs: MeshRepairLog = {
    nonFiniteTriangles: 0,
    collapsedTriangles: 0,
    degenerateTriangles: 0,
    closedHoles: 0,
    inputTriangles: inputTriCount,
    outputTriangles: 0,
  };

  // Allocate optimistically — assume nothing gets dropped. We trim at the end.
  const out = new Float32Array(positions.length);
  let outIdx = 0;

  for (let t = 0; t < inputTriCount; t++) {
    const o = t * 9;
    const ax = positions[o + 0], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];

    // 1. Non-finite check first — area calc would propagate NaN otherwise.
    if (isNonFinite(ax, ay, az) || isNonFinite(bx, by, bz) || isNonFinite(cx, cy, cz)) {
      repairs.nonFiniteTriangles++;
      continue;
    }

    // 2. Exact-coincident check. Two equal vertices = a true zero-edge sliver
    //    that Manifold cannot form a face from. Cheaper than computing area.
    if (
      pointsEqual(ax, ay, az, bx, by, bz) ||
      pointsEqual(bx, by, bz, cx, cy, cz) ||
      pointsEqual(ax, ay, az, cx, cy, cz)
    ) {
      repairs.collapsedTriangles++;
      continue;
    }

    // 3. Area check — catches near-needles that pass the equality check but
    //    are still degenerate in practice (three colinear points, or three
    //    points within floating-point noise of each other).
    const area = triangleArea(ax, ay, az, bx, by, bz, cx, cy, cz);
    if (area < MIN_TRIANGLE_AREA) {
      repairs.degenerateTriangles++;
      continue;
    }

    // Survivor — copy into output.
    out[outIdx++] = ax; out[outIdx++] = ay; out[outIdx++] = az;
    out[outIdx++] = bx; out[outIdx++] = by; out[outIdx++] = bz;
    out[outIdx++] = cx; out[outIdx++] = cy; out[outIdx++] = cz;
  }

  repairs.outputTriangles = outIdx / 9;

  // Trim to actual size. .slice() copies; .subarray() would alias the larger
  // backing buffer and bloat the worker postMessage payload.
  const trimmed = outIdx === out.length ? out : out.slice(0, outIdx);

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(trimmed, 3));
  // Don't compute normals here — generateMold's downstream manifoldToGeometry
  // does that after CSG. Computing now would just be thrown away.

  // If we dispose of nonIndexed when it differs from the input, we don't
  // accidentally release the user's BufferGeometry. We do dispose intermediate
  // copies we created via .toNonIndexed().
  if (nonIndexed !== geometry) nonIndexed.dispose();

  return { geometry: result, repairs };
}

/**
 * True if the repair log shows anything was actually fixed. Used by the UI
 * to decide whether to show a toast.
 */
export function hasRepairs(log: MeshRepairLog): boolean {
  return (
    log.nonFiniteTriangles > 0 ||
    log.collapsedTriangles > 0 ||
    log.degenerateTriangles > 0 ||
    log.closedHoles > 0
  );
}

/**
 * Human-readable one-line summary of what was repaired. Returns `null` when
 * nothing was fixed (so the caller can `if (msg) toast(msg)` cleanly).
 */
export function summarizeRepairs(log: MeshRepairLog): string | null {
  if (!hasRepairs(log)) return null;

  // Two independent kinds of repair can happen: dropping bad triangles
  // (validateMesh) and closing open holes (capOpenBoundaries, hollow mode).
  // Build a clause for whichever occurred and join them into one toast.
  const clauses: string[] = [];

  const droppedTotal =
    log.nonFiniteTriangles + log.collapsedTriangles + log.degenerateTriangles;
  if (droppedTotal > 0) {
    const parts: string[] = [];
    if (log.nonFiniteTriangles > 0) {
      parts.push(`${log.nonFiniteTriangles} with NaN/Infinity vertices`);
    }
    if (log.collapsedTriangles > 0) {
      parts.push(`${log.collapsedTriangles} collapsed (zero-edge slivers)`);
    }
    if (log.degenerateTriangles > 0) {
      parts.push(`${log.degenerateTriangles} degenerate (near-zero area)`);
    }
    clauses.push(
      `dropped ${droppedTotal} bad triangle${droppedTotal === 1 ? '' : 's'} (${parts.join(', ')})`,
    );
  }

  if (log.closedHoles > 0) {
    clauses.push(
      `closed ${log.closedHoles} open hole${log.closedHoles === 1 ? '' : 's'} to make the mesh watertight`,
    );
  }

  return `Auto-repaired your mesh: ${clauses.join('; ')}. Consider cleaning the source file in your modelling tool.`;
}
