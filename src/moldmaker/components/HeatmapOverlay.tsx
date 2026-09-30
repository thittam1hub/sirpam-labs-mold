// Sirpam 3D Labs Mold — colours the model by how easily each face releases.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Axis } from '../types';
import { buildDraftHeatmapGeometry } from '../mold/draftAnalysis';

type Props = { geometry: THREE.BufferGeometry; axis: Axis; offset: number; boundingBox: THREE.Box3; cutAngle?: number };

export default function HeatmapOverlay({ geometry, axis, offset, boundingBox, cutAngle = 0 }: Props) {
  const painted = useMemo(
    () => buildDraftHeatmapGeometry(geometry, axis, offset, boundingBox, cutAngle),
    [geometry, axis, offset, boundingBox, cutAngle],
  );
  useEffect(() => () => painted.dispose(), [painted]);
  return (
    <mesh geometry={painted}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}
