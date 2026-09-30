// Golden baseline for the clean-room engine rewrite. Records piece count,
// volume and size for each sample model in every mold mode, then compares
// later runs against golden.json (volumes within 2%). First run writes it.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import { generateMold } from './generateMold';
import { generateSiliconeMold } from './siliconeMold';
import { buildSampleTemplate, type SampleTemplateId } from '../utils/sampleTemplates';

const FILE = path.join(__dirname, 'golden.json');
const golden: Record<string, Metrics> = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const recorded: Record<string, Metrics> = {};

interface Metrics { pieces: number; volumes: number[]; sizes: number[][] }

function volume(g: THREE.BufferGeometry): number {
  const p = g.attributes['position'].array as ArrayLike<number>;
  let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    v += (p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7])
      - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6])
      + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6])) / 6;
  }
  return Math.abs(v);
}

function metrics(pieces: THREE.BufferGeometry[]): Metrics {
  return {
    pieces: pieces.length,
    volumes: pieces.map(g => Math.round(volume(g))),
    sizes: pieces.map(g => {
      g.computeBoundingBox();
      const s = g.boundingBox!.getSize(new THREE.Vector3());
      return [s.x, s.y, s.z].map(n => Math.round(n * 10) / 10);
    }),
  };
}

const MODELS: SampleTemplateId[] = ['mushroom', 'pawn', 'vase', 'heart'];
const MODES: Record<string, (g: THREE.BufferGeometry) => Promise<{ pieces: THREE.BufferGeometry[] }>> = {
  rigid: g => generateMold(g, g.boundingBox!, 'z', 0.5, {} as never),
  angled: g => generateMold(g, g.boundingBox!, 'z', 0.5, { cutAngle: 10 } as never),
  hug: g => generateMold(g, g.boundingBox!, 'z', 0.5, { formFit: true } as never),
  siliconeBlock: g => generateSiliconeMold(g, g.boundingBox!, 'z', 0.5, { type: 'blockTwoPart' } as never),
  siliconeOpen: g => generateSiliconeMold(g, g.boundingBox!, 'z', 0.5, { type: 'blockOneWay' } as never),
  siliconeSkin: g => generateSiliconeMold(g, g.boundingBox!, 'z', 0.5, { type: 'skinCore' } as never),
};

describe('golden mold baseline', () => {
  for (const m of MODELS) for (const [mode, run] of Object.entries(MODES)) {
    it(`${m} / ${mode}`, async () => {
      const { geometry } = buildSampleTemplate(m);
      geometry.computeBoundingBox();
      const got = metrics((await run(geometry)).pieces);
      const key = `${m}/${mode}`;
      recorded[key] = got;
      const want = golden[key];
      if (!want) return;
      expect(got.pieces).toBe(want.pieces);
      got.volumes.forEach((v, i) => expect(Math.abs(v - want.volumes[i])).toBeLessThanOrEqual(want.volumes[i] * 0.02 + 1));
    }, 180000);
  }
  it('writes baseline when missing', () => {
    if (Object.keys(golden).length === 0) fs.writeFileSync(FILE, JSON.stringify(recorded, null, 1));
  });
});
