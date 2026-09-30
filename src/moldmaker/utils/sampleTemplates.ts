// Bundled sample templates: small procedural models a first-time maker can
// load with one click instead of hunting for an STL. All shapes are closed
// solids (the mold pipeline requires a watertight mesh) and generated at
// runtime — no binary assets, no licensing concerns. The mushroom lives in
// sampleModel.ts because it doubles as the draft-analysis teaching model.
import * as THREE from 'three';
import { createSampleModel } from './sampleModel';

export type SampleTemplateId = 'mushroom' | 'pawn' | 'vase' | 'heart' | 'candle' | 'soap';

export interface SampleTemplate {
  id: SampleTemplateId;
  label: string;
  hint: string;
}

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  { id: 'mushroom', label: 'Mushroom', hint: 'Teaching model — shows an undercut' },
  { id: 'pawn', label: 'Chess pawn', hint: 'Classic turned shape' },
  { id: 'vase', label: 'Vase', hint: 'Wide base, narrow neck' },
  { id: 'heart', label: 'Heart', hint: 'Flat shape with curves' },
  { id: 'candle', label: 'Pillar candle', hint: 'Sets wax + a 3 mm wick pin' },
  { id: 'soap', label: 'Soap bar', hint: 'Sets melt & pour soap' },
];

function finish(geometry: THREE.BufferGeometry, fileName: string) {
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return { geometry, fileName };
}

function buildPawn(): { geometry: THREE.BufferGeometry; fileName: string } {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(7, 0),
    new THREE.Vector2(7, 1.5),
    new THREE.Vector2(3, 2.5),
    new THREE.Vector2(2.5, 4),
    new THREE.Vector2(2.8, 5.5),
    new THREE.Vector2(2.2, 6.5),
    new THREE.Vector2(3.2, 7),
    new THREE.Vector2(3.2, 7.8),
    new THREE.Vector2(2.6, 8.2),
  ];
  // Sphere head: sweep from the bottom pole to the top pole so the lathe
  // closes at both ends (radius returns to 0).
  const headR = 3.2;
  const headY = 11;
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 16;
    profile.push(new THREE.Vector2(Math.max(headR * Math.cos(a), 0), headY + headR * Math.sin(a)));
  }
  return finish(new THREE.LatheGeometry(profile, 40), 'sample-pawn.stl');
}

function buildVase(): { geometry: THREE.BufferGeometry; fileName: string } {
  // Closed solid vase: base → belly → neck → flared lip → folded back to a
  // center point at the top, so the mesh stays watertight.
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(5, 0),
    new THREE.Vector2(6, 2),
    new THREE.Vector2(6.5, 5),
    new THREE.Vector2(4.5, 8),
    new THREE.Vector2(3, 10),
    new THREE.Vector2(3, 12),
    new THREE.Vector2(4.5, 13.5),
    new THREE.Vector2(4.8, 14),
    new THREE.Vector2(4.2, 14),
    new THREE.Vector2(3.8, 13.5),
    new THREE.Vector2(2.4, 12),
    new THREE.Vector2(0, 12),
  ];
  return finish(new THREE.LatheGeometry(profile, 40), 'sample-vase.stl');
}

function buildHeart(): { geometry: THREE.BufferGeometry; fileName: string } {
  const shape = new THREE.Shape();
  shape.moveTo(5, 5);
  shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  shape.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 1,
    bevelSegments: 3,
    curveSegments: 24,
  });
  // Lay the heart flat (face up) so the default Y pull axis makes sense.
  geometry.rotateX(-Math.PI / 2);
  return finish(geometry, 'sample-heart.stl');
}

function buildCandle(): { geometry: THREE.BufferGeometry; fileName: string } {
  // 60 mm pillar, 1° draft, softened top edge; the wick hole comes from the core pin.
  const profile = [
    new THREE.Vector2(0, 0), new THREE.Vector2(25, 0), new THREE.Vector2(24, 57),
    new THREE.Vector2(23, 59), new THREE.Vector2(21, 60), new THREE.Vector2(0, 60),
  ];
  return finish(new THREE.LatheGeometry(profile, 64), 'sample-candle.stl');
}

function buildSoap(): { geometry: THREE.BufferGeometry; fileName: string } {
  // 90 x 60 x 25 mm rounded bar (about 100 g), lying flat.
  const w = 90, d = 60, r = 12;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2); shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 19, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 4, curveSegments: 16,
  });
  geometry.rotateX(-Math.PI / 2);
  return finish(geometry, 'sample-soap.stl');
}

export function buildSampleTemplate(id: SampleTemplateId): { geometry: THREE.BufferGeometry; fileName: string } {
  switch (id) {
    case 'mushroom':
      return createSampleModel();
    case 'pawn':
      return buildPawn();
    case 'vase':
      return buildVase();
    case 'heart':
      return buildHeart();
    case 'candle':
      return buildCandle();
    case 'soap':
      return buildSoap();
  }
}
