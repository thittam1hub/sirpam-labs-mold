// Sirpam 3D Labs Mold — draws where the parting plane cuts the model surface.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Axis } from '../types';
import { buildSplitLineGeometry } from '../mold/splitLine';

type Props = { geometry: THREE.BufferGeometry; axis: Axis; offset: number; boundingBox: THREE.Box3; cutAngle?: number };

export default function SplitLineOverlay({ geometry, axis, offset, boundingBox, cutAngle = 0 }: Props) {
  const line = useMemo(
    () => buildSplitLineGeometry(geometry, axis, offset, boundingBox, cutAngle),
    [geometry, axis, offset, boundingBox, cutAngle],
  );
  useEffect(() => () => line.dispose(), [line]);
  return (
    <lineSegments geometry={line}>
      <lineBasicMaterial color="#e8632b" transparent opacity={0.95} />
    </lineSegments>
  );
}
