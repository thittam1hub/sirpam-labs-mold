// Sirpam 3D Labs Mold — "Doctor view": greys the model, paints faces that will
// lock in or tear the mold red, and pins each likely air pocket with a pulsing
// amber marker. Uses only the engine's own checks (castRisk / draftAnalysis).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Axis } from '../types';
import { buildDraftHeatmapGeometry, DRAFT_COLORS } from '../mold/draftAnalysis';
import { airTrapPoints } from '../mold/castRisk';
import { lateralAxisIndices, primaryAxisIndex } from '../mold/moldBox';

type Props = { geometry: THREE.BufferGeometry; axis: Axis; offset: number; boundingBox: THREE.Box3; cutAngle?: number; onCounts?: (c: { traps: number }) => void };

const GREY = new THREE.Color('#8a8f98');

export default function DoctorOverlay({ geometry, axis, offset, boundingBox, cutAngle = 0, onCounts }: Props) {
  const painted = useMemo(() => {
    const g = buildDraftHeatmapGeometry(geometry, axis, offset, boundingBox, cutAngle);
    const col = g.getAttribute('color') as THREE.BufferAttribute;
    const red = DRAFT_COLORS.red;
    for (let i = 0; i < col.count; i++) {
      const isRed = Math.abs(col.getX(i) - red.r) < 1e-3 && Math.abs(col.getY(i) - red.g) < 1e-3;
      if (!isRed) col.setXYZ(i, GREY.r, GREY.g, GREY.b);
    }
    col.needsUpdate = true;
    return g;
  }, [geometry, axis, offset, boundingBox, cutAngle]);
  useEffect(() => () => painted.dispose(), [painted]);

  const pins = useMemo(() => {
    const [la, lb] = lateralAxisIndices(axis);
    const pi = primaryAxisIndex(axis);
    return airTrapPoints(geometry, axis, boundingBox).map(t => {
      const v = [0, 0, 0];
      v[la] = t.a; v[lb] = t.b; v[pi] = t.p;
      return v as [number, number, number];
    });
  }, [geometry, axis, boundingBox]);
  useEffect(() => { onCounts?.({ traps: pins.length }); }, [pins.length, onCounts]);

  const size = boundingBox.getSize(new THREE.Vector3());
  const r = Math.max(0.8, Math.max(size.x, size.y, size.z) * 0.025);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const s = 1 + 0.35 * Math.sin(clock.elapsedTime * 4);
    group.current?.children.forEach(c => { if (c.userData['halo']) c.scale.setScalar(s); });
  });

  return (
    <>
      <mesh geometry={painted}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <group ref={group}>
        {pins.map((p, i) => (
          <group key={i} position={p}>
            <mesh renderOrder={10}>
              <sphereGeometry args={[r, 16, 12]} />
              <meshBasicMaterial color="#f59e0b" depthTest={false} />
            </mesh>
            <mesh userData={{ halo: true }} renderOrder={9}>
              <sphereGeometry args={[r * 1.9, 16, 12]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.25} depthTest={false} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}
