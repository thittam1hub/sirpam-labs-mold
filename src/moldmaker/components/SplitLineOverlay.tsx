// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Axis } from '../types';
import { buildSplitLineGeometry } from '../mold/splitLine';

/**
 * Split-line overlay — draws the seam where the parting plane crosses the
 * model surface, in the Sirpam ember color. Pair this with the translucent
 * PartingPlane indicator: the plane shows WHERE the cut is, this line shows
 * WHERE it lands on the actual geometry — the difference between "48% up the
 * bounding box" and "right across the handle".
 *
 * Sibling overlay pattern, same as HeatmapOverlay: rebuilds on every slider
 * tick (linear in triangles, cached position buffer) and disposes GPU buffers
 * when replaced or unmounted.
 */
interface SplitLineOverlayProps {
  geometry: THREE.BufferGeometry;
  axis: Axis;
  offset: number;
  boundingBox: THREE.Box3;
  /** Tilt of parting plane, degrees. 0 = axis-aligned. Optional for back-compat. */
  cutAngle?: number;
}

export default function SplitLineOverlay({
  geometry,
  axis,
  offset,
  boundingBox,
  cutAngle = 0,
}: SplitLineOverlayProps) {
  const lineGeo = useMemo(
    () => buildSplitLineGeometry(geometry, axis, offset, boundingBox, cutAngle),
    [geometry, axis, offset, boundingBox, cutAngle],
  );

  useEffect(() => () => lineGeo.dispose(), [lineGeo]);

  return (
    <lineSegments geometry={lineGeo}>
      <lineBasicMaterial
        color="#e8632b"
        // Slightly transparent so the surface shading still reads underneath.
        transparent
        opacity={0.95}
      />
    </lineSegments>
  );
}
