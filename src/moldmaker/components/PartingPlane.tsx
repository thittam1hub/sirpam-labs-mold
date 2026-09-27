// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import { useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Axis } from '../types';
import { getPlaneNormal } from '../mold/planeGeometry';

interface PartingPlaneProps {
  axis: Axis;
  offset: number; // 0-1 normalized
  boundingBox: THREE.Box3;
  /** Tilt of the parting plane around its hinge axis, degrees. 0 = axis-aligned. Optional for back-compat. */
  cutAngle?: number;
  /** When set, the plane can be grabbed and dragged along the axis in 3D. */
  onOffsetChange?: (offset: number) => void;
}

/**
 * Semi-transparent preview quad showing WHERE the mold will be cut. Must
 * match the CSG pipeline's plane exactly, otherwise the preview lies.
 *
 * Orientation: `<planeGeometry>` creates a quad in the XY plane (so its
 * default normal is +Z). We rotate it so that +Z maps to the actual parting
 * plane normal — using `Quaternion.setFromUnitVectors` which handles any
 * (from, to) pair without branching on axis or hinge direction. This keeps
 * the axis-aligned case (cutAngle=0) producing the same Eulers the old code
 * built by hand, and the tilted case "just works" by letting Three derive
 * the right rotation quaternion from the plane normal.
 */
export default function PartingPlane({
  axis,
  offset,
  boundingBox,
  cutAngle = 0,
  onOffsetChange,
}: PartingPlaneProps) {
  const controls = useThree((st) => st.controls);
  const dragging = useRef(false);
  const [hover, setHover] = useState(false);
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const offsetFromRay = (ray) => {
    // Closest point on the axis line (through the bbox centre) to the pointer ray.
    const c = new THREE.Vector3(); boundingBox.getCenter(c);
    const d1 = new THREE.Vector3(); d1.setComponent(axisIdx, 1);
    const d2 = ray.direction, w0 = c.clone().sub(ray.origin);
    const b = d1.dot(d2), cc = d2.dot(d2), d = d1.dot(w0), e = d2.dot(w0);
    const den = cc - b * b;
    if (Math.abs(den) < 1e-6) return null;
    const t = (b * e - cc * d) / den;
    const v = c.getComponent(axisIdx) + t;
    const lo = boundingBox.min.getComponent(axisIdx), hi = boundingBox.max.getComponent(axisIdx);
    return Math.min(0.98, Math.max(0.02, (v - lo) / (hi - lo)));
  };
  const drag = onOffsetChange ? {
    onPointerOver: (e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'grab'; },
    onPointerOut: () => { setHover(false); if (!dragging.current) document.body.style.cursor = ''; },
    onPointerDown: (e) => {
      e.stopPropagation();
      dragging.current = true;
      e.target.setPointerCapture?.(e.pointerId);
      if (controls) controls.enabled = false;
      document.body.style.cursor = 'grabbing';
    },
    onPointerMove: (e) => {
      if (!dragging.current) return;
      e.stopPropagation();
      const o = offsetFromRay(e.ray);
      if (o != null) onOffsetChange(Math.round(o * 100) / 100);
    },
    onPointerUp: (e) => {
      dragging.current = false;
      e.target.releasePointerCapture?.(e.pointerId);
      if (controls) controls.enabled = true;
      document.body.style.cursor = hover ? 'grab' : '';
    },
  } : {};
  const { position, quaternion, size } = useMemo(() => {
    const bboxSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    boundingBox.getSize(bboxSize);
    boundingBox.getCenter(center);

    const margin = 1.3;
    const planeW = Math.max(bboxSize.x, bboxSize.y, bboxSize.z) * margin;

    const min = boundingBox.min;
    const max = boundingBox.max;

    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const val = min.getComponent(axisIdx) + (max.getComponent(axisIdx) - min.getComponent(axisIdx)) * offset;

    // Pivot: centred laterally in the bbox at the current offset along the axis.
    // Matches the pivot used by `getPlaneEquation` so the visual preview rotates
    // around the same point as the CSG plane.
    let pos: [number, number, number];
    switch (axis) {
      case 'x':
        pos = [val, center.y, center.z];
        break;
      case 'y':
        pos = [center.x, val, center.z];
        break;
      case 'z':
      default:
        pos = [center.x, center.y, val];
        break;
    }

    // Plane normal from the math module — identical to what CSG uses.
    const n = getPlaneNormal(axis, cutAngle);
    const planeNormal = new THREE.Vector3(n[0], n[1], n[2]);
    // planeGeometry's local +Z points "out of the page". Rotate that local Z
    // to the target plane normal. For axis='z', cutAngle=0 this returns the
    // identity quaternion → equivalent to the legacy rot=[0,0,0].
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      planeNormal,
    );

    return { position: pos, quaternion: q, size: planeW };
  }, [axis, offset, boundingBox, cutAngle]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh {...drag}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color="#ff6b35"
          transparent
          opacity={hover ? 0.32 : 0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Border */}
      <lineLoop>
        <bufferGeometry>
          {/* R3F's JSX typings for bufferAttribute require `args` — the
              constructor-tuple form (array, itemSize). Older code passed
              count/array/itemSize as individual props; newer @types/three
              + @react-three/fiber enforce the tuple shape. */}
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                -size / 2, -size / 2, 0,
                size / 2, -size / 2, 0,
                size / 2, size / 2, 0,
                -size / 2, size / 2, 0,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ff6b35" opacity={0.6} transparent />
      </lineLoop>
    </group>
  );
}
