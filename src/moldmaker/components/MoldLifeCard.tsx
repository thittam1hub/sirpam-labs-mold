// Sirpam 3D Labs Mold — mold life, cost per cast and print settings for the Finish step.
import * as THREE from 'three';
import type { AppState } from '../App';
import { meshVolumeCm3, estimatePieceCost, estimateSiliconeCost } from '../utils/costEstimate';
import { solidProps, CASTING_MATERIALS } from '../utils/tier2';
import { estimateMoldLife, costPerCast, recommendPrintSettings } from '../utils/moldLife';
import { styles, colors, spacing } from './panel/tokens';

const inr = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: v < 100 ? 2 : 0 })}`;

interface Props {
  state: AppState;
  estimator: { material: 'pla' | 'resin'; pricePerKg: number; siliconePricePerLiter: number; castingPricePerKg: number };
  castPriceDefault: number;
}

export function MoldLifeCard({ state, estimator, castPriceDefault }: Props) {
  const mat = CASTING_MATERIALS.find(m => m.id === state.tier2.castingMaterial) ?? CASTING_MATERIALS[0]!;
  const silicone = state.moldMode === 'silicone';
  const life = estimateMoldLife(silicone ? 'silicone' : estimator.material === 'resin' ? 'rigid-resin' : 'rigid-pla', mat.id);

  const printCost = state.moldPieces.reduce((s, p) => s + estimatePieceCost(
    meshVolumeCm3(p.getAttribute('position').array as Float32Array, p.index ? (p.index.array as ArrayLike<number>) : null),
    estimator.material, estimator.pricePerKg).cost, 0);
  const moldCost = silicone ? estimateSiliconeCost(state.siliconeVolumeCm3, estimator.siliconePricePerLiter).cost : printCost;
  const partCm3 = state.originalGeometry ? solidProps(state.originalGeometry).volume / 1000 : 0;
  const cavities = Math.max(1, state.tier2.cavityCount);
  const castCost = partCm3 * cavities * 1.05 * mat.density / 1000 * (estimator.castingPricePerKg || castPriceDefault);
  const perCast = costPerCast(moldCost, castCost, life) / cavities;

  const first = state.moldPieces[0];
  let size: [number, number, number] = [0, 0, 0];
  if (first) {
    first.computeBoundingBox();
    const v = first.boundingBox!.getSize(new THREE.Vector3());
    size = [v.x, v.y, v.z];
  }
  const ps = recommendPrintSettings(estimator.material, size, silicone ? 'silicone' : 'rigid');

  return (
    <>
      <div style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Mold life & cost per piece</h2>
        <div style={styles.statRow}><span>Expected casts</span><span>{life.min}–{life.max}</span></div>
        <div style={styles.statRow}><span>Mold cost (once)</span><span>{inr(moldCost)}</span></div>
        <div style={{ ...styles.statRow, color: colors.textPrimary }}><span>Cost per finished piece</span><span>{inr(perCast)}</span></div>
        <div style={{ ...styles.hint, marginTop: spacing.xs }}>{life.note} Mold cost is spread over the middle of the range, plus the material for one piece.</div>
      </div>
      <div style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Print settings</h2>
        <div style={styles.statRow}><span>Layer height</span><span>{ps.layerMm} mm</span></div>
        {ps.walls > 0 && <div style={styles.statRow}><span>Walls</span><span>{ps.walls}</span></div>}
        <div style={styles.statRow}><span>Infill</span><span>{ps.infillPct}%</span></div>
        <div style={{ ...styles.hint, marginTop: spacing.xs }}>{ps.orientation}</div>
        <ul style={{ ...styles.hint, margin: `${spacing.xs}px 0 0`, paddingLeft: 18 }}>
          {ps.tips.map(t => <li key={t}>{t}</li>)}
        </ul>
        <button type="button" style={{ ...styles.button, ...styles.secondaryBtn, marginTop: spacing.sm, width: '100%' }} onClick={() => window.print()}>
          Print this sheet
        </button>
      </div>
    </>
  );
}
