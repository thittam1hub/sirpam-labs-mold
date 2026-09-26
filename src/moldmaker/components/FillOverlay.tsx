import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Axis } from '../types';
import { computeFill } from '../utils/shopAdvice';

/** Animated gravity-fill estimate: material rises from the bottom; red dots mark likely air traps. */
export default function FillOverlay({ geometry, axis, onTraps }: { geometry: THREE.BufferGeometry; axis: Axis; onTraps?: (n: number) => void }) {
  const data = useMemo(() => computeFill(geometry, axis), [geometry, axis]);
  const t0 = useRef(0);
  useEffect(() => { onTraps?.(data.traps.length); }, [data, onTraps]);
  useEffect(() => () => data.geometry.dispose(), [data]);
  const r = Math.max(1, (data.hMax - data.hMin) * 0.025);

  useFrame((_, dt) => {
    t0.current = (t0.current + dt / 6) % 1.15;
    const level = data.hMin + (data.hMax - data.hMin) * Math.min(1, t0.current);
    const col = data.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = col.array as Float32Array;
    for (let i = 0; i < data.heights.length; i++) {
      const filled = data.heights[i]! <= level;
      arr[i * 3] = filled ? 0.91 : 0.78; arr[i * 3 + 1] = filled ? 0.39 : 0.8; arr[i * 3 + 2] = filled ? 0.17 : 0.84;
    }
    col.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={data.geometry}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      {data.traps.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshBasicMaterial color="#d62828" />
        </mesh>
      ))}
    </group>
  );
}
