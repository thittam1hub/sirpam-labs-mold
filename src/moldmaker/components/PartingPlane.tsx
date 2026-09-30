// Sirpam 3D Labs Mold — the translucent split plane. It can be dragged along
// its axis; the drag position is the point on the axis line closest to the
// mouse ray.
import { useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Axis } from '../types';
import { getPlaneNormal } from '../mold/planeGeometry';

type Props = {
  axis: Axis;
  /** 0..1 along the model's extent on `axis`. */
  offset: number;
  boundingBox: THREE.Box3;
  cutAngle?: number;
  onOffsetChange?: (offset: number) => void;
};

const IDX: Record<Axis, number> = { x: 0, y: 1, z: 2 };
const TINT = '#ff6b35';

export default function PartingPlane({ axis, offset, boundingBox, cutAngle = 0, onOffsetChange }: Props) {
  const controls = useThree(s => s.controls) as { enabled: boolean } | null;
  const dragging = useRef(false);
  const [hover, setHover] = useState(false);
  const k = IDX[axis];

  /** Closest point between the axis line through the box centre and the mouse ray → normalised offset. */
  const offsetAt = (ray: THREE.Ray): number | null => {
    const centre = boundingBox.getCenter(new THREE.Vector3());
    const u = new THREE.Vector3().setComponent(k, 1);
    const w = centre.clone().sub(ray.origin);
    const ud = u.dot(ray.direction);
    const dd = ray.direction.dot(ray.direction);
    const denom = dd - ud * ud;
    if (Math.abs(denom) < 1e-6) return null; // looking straight down the axis
    const s = (ud * ray.direction.dot(w) - dd * u.dot(w)) / denom;
    const lo = boundingBox.min.getComponent(k);
    const hi = boundingBox.max.getComponent(k);
    const t = (centre.getComponent(k) + s - lo) / (hi - lo);
    return THREE.MathUtils.clamp(t, 0.02, 0.98);
  };

  const setCursor = (c: string) => { document.body.style.cursor = c; };
  const handlers = onOffsetChange
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); setCursor('grab'); },
        onPointerOut: () => { setHover(false); if (!dragging.current) setCursor(''); },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          dragging.current = true;
          (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
          if (controls) controls.enabled = false;
          setCursor('grabbing');
        },
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          if (!dragging.current) return;
          e.stopPropagation();
          const t = offsetAt(e.ray);
          if (t !== null) onOffsetChange(Math.round(t * 100) / 100);
        },
        onPointerUp: (e: ThreeEvent<PointerEvent>) => {
          dragging.current = false;
          (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
          if (controls) controls.enabled = true;
          setCursor(hover ? 'grab' : '');
        },
      }
    : {};

  const { position, quaternion, size } = useMemo(() => {
    const dims = boundingBox.getSize(new THREE.Vector3());
    const pos = boundingBox.getCenter(new THREE.Vector3());
    pos.setComponent(k, THREE.MathUtils.lerp(boundingBox.min.getComponent(k), boundingBox.max.getComponent(k), offset));
    const n = getPlaneNormal(axis, cutAngle);
    return {
      position: pos.toArray() as [number, number, number],
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2])),
      size: Math.max(dims.x, dims.y, dims.z) * 1.3,
    };
  }, [axis, k, offset, boundingBox, cutAngle]);

  const h = size / 2;
  const outline = useMemo(() => new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0]), [h]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh {...handlers}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={TINT} transparent opacity={hover ? 0.32 : 0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outline, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={TINT} opacity={0.6} transparent />
      </lineLoop>
    </group>
  );
}
