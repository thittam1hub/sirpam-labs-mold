// Sirpam 3D Labs Mold — material compatibility advisor.
// Plain-language rules mapping (casting material × mold kind × print material)
// to OK / caution / blocked, so customers learn about cure inhibition, heat
// limits and food safety before they waste silicone or resin.
import type { CastingMaterialId } from '../utils/tier2';
import type { MoldMode, SiliconeMoldType } from '../types';

export type CompatLevel = 'ok' | 'caution' | 'blocked';

export interface CompatResult {
  level: CompatLevel;
  /** Short headline, e.g. "PLA mold will soften". */
  title: string;
  /** Plain-language explanation and what to do instead. */
  detail: string;
}

export interface CompatInput {
  castingMaterial: CastingMaterialId;
  moldMode: MoldMode;
  siliconeType: SiliconeMoldType;
  /** What the mold (rigid) or the master model (silicone) is printed in. */
  printMaterial: 'pla' | 'resin';
}

/**
 * Evaluate one combination. Rules are checked most-severe-first; the first
 * match wins so the customer sees one clear message, not a pile of warnings.
 */
export function checkCompatibility(i: CompatInput): CompatResult {
  const rigid = i.moldMode === 'rigid';

  // ── Food safety ────────────────────────────────────────────────────────
  if (i.castingMaterial === 'chocolate' && rigid) {
    return {
      level: 'blocked',
      title: 'Never cast food in a printed mold',
      detail: 'Printed plastic is not food-safe — layer lines trap bacteria and the plastic can leach. Print the model, make a food-grade platinum silicone mold from it, and cast the chocolate in that.',
    };
  }

  // ── Heat limits of a printed rigid mold ────────────────────────────────
  if (rigid && i.printMaterial === 'pla' && (i.castingMaterial === 'wax' || i.castingMaterial === 'soap')) {
    return {
      level: 'blocked',
      title: 'PLA mold will soften',
      detail: i.castingMaterial === 'wax'
        ? 'Candle wax is poured at 70–85 °C but PLA softens near 55 °C — the mold will warp and leak. Print the mold in PETG/ASA or resin, or switch to a silicone mold.'
        : 'Melt-and-pour soap goes in at 60–70 °C, above PLA’s softening point. Use PETG/ASA or resin for the mold, or a silicone mold.',
    };
  }
  if (rigid && i.printMaterial === 'pla' && i.castingMaterial === 'epoxy') {
    return {
      level: 'caution',
      title: 'Epoxy heat can warp PLA',
      detail: 'Epoxy heats itself as it cures and thick pours can pass 60 °C. Pour in layers under 2 cm, or print the mold in PETG/ASA or resin to be safe.',
    };
  }

  // ── Silicone cure inhibition from the printed master ──────────────────
  if (!rigid && i.printMaterial === 'resin') {
    return {
      level: 'caution',
      title: 'Resin prints can stop silicone curing',
      detail: 'Some MSLA resins leave a surface that inhibits platinum-cure silicone — the mold stays tacky where it touched the model. Wash and fully post-cure the model, then seal it (acrylic clear coat or PVA) before pouring silicone. Test a small patch first.',
    };
  }
  if (!rigid && i.printMaterial === 'pla' && i.castingMaterial === 'silicone_cast') {
    return {
      level: 'caution',
      title: 'Silicone sticks to silicone',
      detail: 'Casting silicone into a silicone mold only works with a release barrier (petroleum jelly or Ease Release) on every surface, or the cast welds to the mold.',
    };
  }

  // ── Structural fit ─────────────────────────────────────────────────────
  if (!rigid && i.siliconeType === 'skinCore' && (i.castingMaterial === 'concrete' || i.castingMaterial === 'plaster')) {
    return {
      level: 'caution',
      title: 'Thin skin mold may bulge',
      detail: 'Plaster and concrete are heavy and push hard on the mold walls. A thin skin-coat mold needs a rigid mother mold (the printed core shell) strapped tight, or use a block mold with 15 mm+ walls.',
    };
  }
  if (rigid && i.castingMaterial === 'silicone_cast') {
    return {
      level: 'ok',
      title: 'Good combination',
      detail: 'Silicone releases cleanly from a rigid printed mold. A light release spray still helps with fine detail.',
    };
  }

  return {
    level: 'ok',
    title: 'Good combination',
    detail: rigid
      ? 'This casting material works with a printed rigid mold. Use mold release for resins.'
      : 'This casting material works with a silicone mold. Follow the silicone datasheet for mixing and degassing.',
  };
}

/** Worst level wins, for summarising several checks. */
export function worstLevel(a: CompatLevel, b: CompatLevel): CompatLevel {
  const rank: Record<CompatLevel, number> = { ok: 0, caution: 1, blocked: 2 };
  return rank[a] >= rank[b] ? a : b;
}
