// Sirpam 3D Labs Mold — renders one mesh (model or mold piece) with a faint edge outline.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Props = {
  geometry: THREE.BufferGeometry;
  color?: string;
  opacity?: number;
  position?: [number, number, number];
  wireframe?: boolean;
};

export default function ModelViewer({ geometry, color = '#6c9bcf', opacity = 0.9, position = [0, 0, 0], wireframe = false }: Props) {
  // Only draw creases sharper than 30° so smooth surfaces stay clean.
  const creases = useMemo(() => new THREE.EdgesGeometry(geometry, 30), [geometry]);
  useEffect(() => () => creases.dispose(), [creases]);
  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.35}
          metalness={0.1}
          clearcoat={0.3}
          side={THREE.DoubleSide}
          wireframe={wireframe}
        />
      </mesh>
      <lineSegments geometry={creases}>
        <lineBasicMaterial color={color} transparent opacity={0.15} />
      </lineSegments>
    </group>
  );
}
