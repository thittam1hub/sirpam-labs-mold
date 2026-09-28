import { it } from 'vitest';
import * as THREE from 'three';
import * as S from '../utils/sampleModel';
import { generateMold } from './generateMold';
import * as F from './formFitLocks';
it('dbg', async () => {
  const fn: any = Object.values(S).find(v => typeof v === 'function');
  let g: THREE.BufferGeometry = await fn();
  if ((g as any).geometry) g = (g as any).geometry;
  g.computeBoundingBox();
  console.log('bb', g.boundingBox);
  for (const axis of ['x','y','z'] as const) for (const wr of [0.1, 0.15]) {
  const r = await generateMold(g, g.boundingBox!, axis, 0.5, { wallThicknessRatio: wr, clearanceMm: 0.2, sprueDiameterMm: 5, moldBoxShape: 'rect', cutAngle: 0, formFit: true } as any);
  console.log('notices', axis, wr, r.notices); }
}, 60000);
