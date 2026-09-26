import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { computeThickness } from '../utils/shopAdvice';

/** Colours the model by local wall thickness: red < 1.5 mm, yellow < 3 mm, green above. */
export default function ThicknessOverlay({ geometry, onMin }: { geometry: THREE.BufferGeometry; onMin?: (mm: number) => void }) {
  const res = useMemo(() => computeThickness(geometry), [geometry]);
  useEffect(() => { onMin?.(res.min); }, [res, onMin]);
  useEffect(() => () => res.geometry.dispose(), [res]);
  return (
    <mesh geometry={res.geometry}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}
