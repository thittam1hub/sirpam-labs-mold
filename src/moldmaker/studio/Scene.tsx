// Sirpam 3D Labs Mold — R3F canvas: camera rig, model/mold meshes, overlays.
import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import ModelViewer from '../components/ModelViewer';
import PartingPlane from '../components/PartingPlane';
import HeatmapOverlay from '../components/HeatmapOverlay';
import SplitLineOverlay from '../components/SplitLineOverlay';
import FillOverlay from '../components/FillOverlay';
import ThicknessOverlay from '../components/ThicknessOverlay';
import { EXPLODE_OFFSET_RATIO } from '../hooks/useMoldGenerator';
import type { Axis } from '../types';
import type { AppState } from './state';

/**
 * Re-aims the camera along the parting axis whenever it changes, so the
 * "top" face of the mold (where the sprue exits) always faces the viewer.
 * Preserves the user's current zoom distance so switching axis doesn't
 * snap the view back to a default distance.
 */
function CameraRig({ axis, fitSize }: { axis: Axis; fitSize?: number }) {
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls) as { target?: THREE.Vector3; update?: () => void } | null;
  const prevAxis = useRef<Axis | null>(null);
  const prevFit = useRef<number | undefined>(undefined);
  useEffect(() => {
    const newModel = fitSize && fitSize !== prevFit.current;
    if (prevAxis.current === axis && !newModel) return;
    prevAxis.current = axis;
    prevFit.current = fitSize;

    const dist = newModel ? Math.max(40, fitSize * 2.4) : (camera.position.length() || 120);

    const pos: [number, number, number] = [0, 0, 0];
    const primary = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    pos[primary] = dist * 0.78;
    pos[(primary + 1) % 3] = dist * 0.45;
    pos[(primary + 2) % 3] = dist * 0.45;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    if (controls?.target && typeof controls.update === 'function') {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [axis, fitSize, camera, controls]);
  return null;
}

/** Cycle through a small palette so each mold piece gets a distinct colour. */
const PIECE_COLORS = [
  '#5b9bd5', // top — legacy blue
  '#e07070', // bottom — legacy red
  '#7bc77b', // green
  '#d9a14e', // orange
  '#a980d6', // purple
  '#54bcb8', // teal
] as const;

export function getPieceColor(index: number): string {
  return PIECE_COLORS[index % PIECE_COLORS.length];
}

/**
 * Exploded-view offset for piece N in an N-piece mold. For 2-piece molds
 * this reduces to piece 0 → +1, piece 1 → -1 along the primary axis. For
 * N>2, direction alternates and magnitude grows every pair so extra pieces
 * fan out past the primary halves instead of colliding with them.
 */
export function getExplodeOffsetForPiece(axis: Axis, index: number, bbox: THREE.Box3): [number, number, number] {
  const direction = index % 2 === 0 ? 1 : -1;
  const ring = Math.floor(index / 2) + 1;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const dist = Math.max(size.x, size.y, size.z) * EXPLODE_OFFSET_RATIO * ring;
  switch (axis) {
    case 'x': return [direction * dist, 0, 0];
    case 'y': return [0, direction * dist, 0];
    case 'z': return [0, 0, direction * dist];
  }
}

export interface StudioSceneProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  themeMode: string;
  sceneCols: { sceneBg: string; gridMajor: string; gridMinor: string };
  modelFitSize: number | undefined;
  showThickness: boolean;
  showFill: boolean;
  onTrapCount: (n: number) => void;
  onThicknessMin: (n: number) => void;
  onCreated: () => void;
  showPartingPlaneIndicator: boolean;
}

/** The full 3D viewport contents: lights, model/mold meshes, overlays, gizmo. */
export default function StudioScene({
  state, setState, themeMode, sceneCols, modelFitSize,
  showThickness, showFill, onTrapCount, onThicknessMin, onCreated, showPartingPlaneIndicator,
}: StudioSceneProps) {
  return (
    <Canvas
      onCreated={onCreated}
      camera={{ position: [80, 60, 80], fov: 50, near: 0.1, far: 10000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color key={`background-${themeMode}`} attach="background" args={[sceneCols.sceneBg]} />
      <CameraRig axis={state.axis} fitSize={modelFitSize} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />

      {/* Print-scale wrapper: everything inside scales together so the
          viewport visually matches the exported file size. Grid/gizmo stay
          outside — they're world-space reference, not part-space. */}
      <group scale={[state.scale, state.scale, state.scale]}>
        {state.originalGeometry && showFill && !showThickness && (
          <FillOverlay geometry={state.originalGeometry} axis={state.axis} onTraps={onTrapCount} />
        )}
        {state.originalGeometry && showThickness && (
          <ThicknessOverlay geometry={state.originalGeometry} onMin={onThicknessMin} />
        )}
        {state.originalGeometry && state.boundingBox && state.showHeatmap && !showThickness && !showFill && (
          <HeatmapOverlay
            geometry={state.originalGeometry}
            axis={state.axis}
            offset={state.planeOffset}
            boundingBox={state.boundingBox}
            cutAngle={state.cutAngle}
            onOffsetChange={(offset: number) => setState(prev => ({ ...prev, planeOffset: offset }))}
          />
        )}

        {state.originalGeometry && state.boundingBox &&
         state.showSplitLine && !state.showHeatmap && state.showOriginal && (
          <SplitLineOverlay
            geometry={state.originalGeometry}
            axis={state.axis}
            offset={state.planeOffset}
            boundingBox={state.boundingBox}
            cutAngle={state.cutAngle}
          />
        )}

        {state.originalGeometry && !state.showHeatmap && !showThickness && !showFill && state.showOriginal && (
          <ModelViewer
            geometry={state.originalGeometry}
            color="#6c9bcf"
            opacity={state.moldGenerated ? 0.3 : 0.9}
            wireframe={state.wireframe}
          />
        )}

        {state.moldGenerated && state.moldPieces.map((piece, i) => (
          <ModelViewer
            key={i}
            geometry={piece}
            color={getPieceColor(i)}
            opacity={0.85}
            position={state.explodedView ? getExplodeOffsetForPiece(state.axis, i, state.boundingBox!) : [0, 0, 0]}
            wireframe={state.wireframe}
          />
        ))}

        {showPartingPlaneIndicator && (
          <PartingPlane axis={state.axis} offset={state.planeOffset} boundingBox={state.boundingBox!} cutAngle={state.cutAngle} />
        )}

        {showPartingPlaneIndicator && state.additionalPlanes.map((plane, i) => (
          <PartingPlane key={`extra-${i}`} axis={plane.axis} offset={plane.offset} boundingBox={state.boundingBox!} cutAngle={plane.cutAngle} />
        ))}
      </group>

      <OrbitControls makeDefault />
      <gridHelper key={`grid-${themeMode}`} args={[200, 20, sceneCols.gridMajor, sceneCols.gridMinor]} />

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport />
      </GizmoHelper>
    </Canvas>
  );
}
