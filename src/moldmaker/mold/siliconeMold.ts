// Sirpam 3D Labs Mold — printed tooling for silicone molds.
//
// Three workflows:
//   blockOneWay   open-top pour box: glue the model down, pour silicone over
//                 it, cut it out once cured
//   blockTwoPart  closed box split in two with pins, pour hole and vents;
//                 silicone is poured around the model inside it
//   skinCore      thin silicone skin + rigid two-part "mother" shell that
//                 holds it in shape; the skin gap = model grown by the skin
//                 thickness
// Box shapes follow the chosen block shape, or hug the model (formFit).
/* eslint-disable @typescript-eslint/no-explicit-any -- Manifold wasm handles */
import * as THREE from 'three';
import type { Axis, MoldBoxShape, SiliconeMoldType } from '../types';
import {
  WALL_THICKNESS_RATIO, CLEARANCE_MM, SPRUE_DIAMETER_MM, PIN_RADIUS_RATIO, PIN_HEIGHT_RATIO, ENABLE_OBLIQUE_PLANES,
} from './constants';
import { clampCutAngle, getPlaneEquation } from './planeGeometry';
import { getManifold, geometryToManifold, manifoldToGeometry } from './manifoldBridge';
import { validateMesh, type MeshRepairLog } from './validateMesh';
import { capOpenBoundaries } from './capOpenBoundaries';
import { getRegistrationPinPositionsForEnvelope, getRotationForAxis } from './channelPlacement';
import { computeMoldEnvelope, createMoldBoxManifold, primaryAxisIndex, lateralAxisIndices, type MoldEnvelope } from './moldBox';
import { envelopeAroundManifold, offsetOutward } from './moldOffset';
import { buildPartingFlange, planHugLocks, cavityHighPoints, flangeBoltCutters, skinRim, partingBoard } from './formFitLocks';
import {
  type MoldExtras, applyTongueGroove, applyPryPockets, applyRadialSplit, asymmetricCavityBox, lateralToWorld,
} from './moldFeatures';

export interface SiliconeMoldOptions {
  type: SiliconeMoldType;
  /** Silicone thickness around the model for block molds (mm). */
  siliconeMarginMm?: number;
  /** Skin thickness for skin molds (mm). */
  skinThicknessMm?: number;
  wallThicknessRatio?: number;
  clearanceMm?: number;
  sprueDiameterMm?: number;
  moldBoxShape?: MoldBoxShape;
  cutAngle?: number;
  /** Skin molds: also export the model itself as a core. Default true. */
  includeCore?: boolean;
  isHollow?: boolean;
  formFit?: boolean;
  extras?: MoldExtras;
}

export interface SiliconeMoldResult {
  pieces: THREE.BufferGeometry[];
  notices?: string[];
  labels: string[];
  repairs: MeshRepairLog;
  /** Silicone needed, cm³ (cavity minus model). */
  siliconeVolumeCm3: number;
}

type Solid = any;
type P3 = [number, number, number];

/** Default silicone around the model: 8% of its size, at least 10 mm. */
const defaultMargin = (longest: number) => Math.max(10, longest * 0.08);
/** Default skin: 4% of its size, at least 4 mm. */
const defaultSkin = (longest: number) => Math.max(4, longest * 0.04);

const cm3 = (s: Solid) => { try { return Math.max(0, s.volume()) / 1000; } catch { return 0; } };

export async function generateSiliconeMold(
  geometry: THREE.BufferGeometry,
  boundingBox: THREE.Box3,
  axis: Axis,
  offset: number,
  options: SiliconeMoldOptions,
): Promise<SiliconeMoldResult> {
  const wasm = await getManifold();
  const { Manifold } = wasm;
  const size = boundingBox.getSize(new THREE.Vector3());
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) {
    throw new Error("This model is flat in at least one direction, so a silicone mold can't be made for it.");
  }
  const longest = Math.max(size.x, size.y, size.z);
  const wall = longest * (options.wallThicknessRatio ?? WALL_THICKNESS_RATIO);
  const clearance = options.clearanceMm ?? CLEARANCE_MM;
  const sprueR = Math.max((options.sprueDiameterMm ?? SPRUE_DIAMETER_MM) / 2, 1.5);
  const shape: MoldBoxShape = options.moldBoxShape ?? 'rect';
  const cutAngle = ENABLE_OBLIQUE_PLANES ? clampCutAngle(options.cutAngle ?? 0) : 0;
  const extras: MoldExtras = options.extras ?? {};
  const hug = !!options.formFit;
  const p = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  const rot = getRotationForAxis(axis);
  const notices: string[] = [];
  const centre = boundingBox.getCenter(new THREE.Vector3());
  const lateralCentre = { a: centre.getComponent(la), b: centre.getComponent(lb) };
  const flangeThickness = Math.max(6, wall * 2);
  const flat = cutAngle === 0;

  const { geometry: cleaned, repairs } = validateMesh(geometry);
  let clean = cleaned;
  if (options.isHollow) {
    const cap = capOpenBoundaries(clean);
    repairs.closedHoles = cap.holesClosed;
    clean = cap.geometry;
  }
  let master: Solid;
  try { master = geometryToManifold(wasm, clean); } catch {
    throw new Error('The model is not a closed solid. Use "Repair broken model" in the Model step and try again.');
  }

  /** Centred cylinder along the split axis. */
  const rod = (h: number, r0: number, r1: number, seg: number, at: P3) =>
    Manifold.cylinder(h, r0, r1, seg, true).rotate(rot).translate(at);
  const splitAt = (box: THREE.Box3) => {
    const lo = box.min.getComponent(p);
    return lo + (box.max.getComponent(p) - lo) * offset;
  };

  let hugCavity: Solid | null = null;
  let flangeT = 0;
  let lastEnv: MoldEnvelope | null = null;

  /** Pour hole over the cavity centre (or highest point on hug molds) plus two vents. */
  const drillPour = (solid: Solid, env: MoldEnvelope, cavityBox: THREE.Box3): Solid => {
    const roof = env.moldMin.getComponent(p) + env.moldSize.getComponent(p);
    const len = wall * 6;
    const cc = cavityBox.getCenter(new THREE.Vector3());
    const sprue: P3 = [0, 0, 0];
    sprue[p] = roof - len / 2 + wall;
    sprue[la] = cc.getComponent(la);
    sprue[lb] = cc.getComponent(lb);
    let highs: number[][] = [];
    const cavities = extras.cavityCenters ?? [];
    if (hug && cavities.length <= 1) {
      highs = cavityHighPoints(clean.getAttribute('position').array, axis, 3, Math.max(sprueR * 4, longest * 0.2));
      const h0 = highs[0];
      if (h0) { sprue[la] = h0[la]!; sprue[lb] = h0[lb]!; }
    }
    const pours: P3[] = cavities.length > 1
      ? cavities.map(c => lateralToWorld(axis, c.a, c.b, sprue[p]) as P3)
      : [sprue];
    let out = solid;
    for (const at of pours) out = out.subtract(rod(len, sprueR * 0.7, sprueR, 24, at));
    const ventR = Math.max(sprueR * 0.25, 0.8);
    const inset = wall * 0.6;
    const ventSpots: Array<[number, number]> = highs.length > 1
      ? highs.slice(1).map(q => [q[la]!, q[lb]!])
      : [
          [cavityBox.min.getComponent(la) + inset, cavityBox.min.getComponent(lb) + inset],
          [cavityBox.max.getComponent(la) - inset, cavityBox.max.getComponent(lb) - inset],
        ];
    for (const [a, b] of ventSpots) {
      const at: P3 = [0, 0, 0];
      at[p] = sprue[p]; at[la] = a; at[lb] = b;
      out = out.subtract(rod(len, ventR, ventR * 1.2, 12, at));
    }
    return out;
  };

  /** Split a shell in two and add alignment (pins, hug locks, or tongue & groove). */
  const splitWithLocks = (solid: Solid, env: MoldEnvelope, refBox: THREE.Box3): [Solid, Solid] => {
    const eq = getPlaneEquation(
      [refBox.min.x, refBox.min.y, refBox.min.z], [refBox.max.x, refBox.max.y, refBox.max.z], axis, offset, cutAngle,
    );
    let [top, bottom] = solid.splitByPlane(eq.normal as P3, eq.originOffset);
    const splitPos = splitAt(refBox);
    const pinH = wall * PIN_HEIGHT_RATIO;
    let pinR = wall * PIN_RADIUS_RATIO;
    let pins: P3[] = getRegistrationPinPositionsForEnvelope(env, refBox, splitPos, cutAngle);
    let pads: Array<{ at: number[]; r: number; halfHeight: number }> = [];
    let bolts: Solid[] = [];
    if (hug) {
      if (!flat) {
        pins = [];
        notices.push('Locks on a form-fit shell need a flat, untilted split, so this mold has none. Set the tilt to 0 or use a box shell.');
      } else {
        const plan = planHugLocks(wasm, solid, axis, splitPos, lateralCentre, pinR, clearance, 4, pinH);
        pins = plan.positions as P3[]; pinR = plan.lockR; pads = plan.pads; notices.push(...plan.notices);
        if (flangeT > 0 && (extras.flangeBoltMm ?? 0) > 0) {
          bolts = flangeBoltCutters(wasm, solid, axis, splitPos, lateralCentre, extras.flangeBoltMm!, flangeT, 4);
          if (bolts.length < 4) notices.push(`Only ${bolts.length} of 4 bolt holes fit in the flange. Make the flange wider for more.`);
        }
      }
    }
    let sealed = false;
    if (extras.seal === 'tongueGroove') {
      const tg = flat && !hug
        ? applyTongueGroove(wasm, top, bottom, {
            axis, cavityBox: refBox, envMin: env.moldMin, envSize: env.moldSize, splitPos, wallThickness: wall, clearance,
          })
        : null;
      if (tg) { [top, bottom] = tg; sealed = true; }
      else notices.push(!flat
        ? 'Tongue & groove needs a flat, untilted split, so keyed pins were used instead.'
        : hug
          ? 'Tongue & groove needs a box shell, not a form-fit shell, so keyed pins were used instead.'
          : 'Tongue & groove could not be built around this cavity (the wall is too thin at the split), so keyed pins were used instead.');
    }
    const keepOut = hugCavity ?? master;
    for (const pad of pads) {
      const h = pad.halfHeight;
      const at = (dz: number) => pad.at.map((v, i) => (i === p ? splitPos + dz : v)) as P3;
      top = top.add(rod(h, pad.r, pad.r, 32, at(h / 2)).subtract(keepOut));
      bottom = bottom.add(rod(h, pad.r, pad.r, 32, at(-h / 2)).subtract(keepOut));
    }
    for (const b of bolts) { top = top.subtract(b); bottom = bottom.subtract(b); }
    for (const at of sealed ? [] : pins) {
      top = top.add(rod(pinH, pinR, pinR, 16, at));
      bottom = bottom.subtract(rod(pinH + 2 * clearance, pinR + clearance, pinR + clearance, 16, at));
    }
    lastEnv = env;
    if (extras.pryPockets) {
      [top, bottom] = applyPryPockets(wasm, [top, bottom], {
        axis, envMin: env.moldMin, envSize: env.moldSize, splitPos, wallThickness: wall,
      });
    }
    return [top, bottom];
  };

  const pieces: Solid[] = [];
  const labels: string[] = [];
  let siliconeVolumeCm3 = 0;

  if (options.type === 'blockOneWay' || options.type === 'blockTwoPart') {
    const margin = options.siliconeMarginMm ?? defaultMargin(longest);
    let outer: Solid, cavity: Solid, cavityBox: THREE.Box3, env: MoldEnvelope;
    if (hug) {
      cavity = offsetOutward(wasm, master, margin, boundingBox);
      outer = offsetOutward(wasm, master, margin + wall, boundingBox);
      cavityBox = boundingBox.clone().expandByScalar(margin);
      env = envelopeAroundManifold(outer, axis, wall);
    } else {
      const sm = extras.siliconeMargins;
      cavityBox = sm && (sm.top > 0 || sm.bottom > 0 || sm.sides > 0)
        ? asymmetricCavityBox(boundingBox, axis, { top: sm.top || margin, bottom: sm.bottom || margin, sides: sm.sides || margin })
        : boundingBox.clone().expandByScalar(margin);
      env = computeMoldEnvelope(cavityBox, shape, axis, wall);
      outer = createMoldBoxManifold(wasm, env);
      cavity = createMoldBoxManifold(wasm, computeMoldEnvelope(cavityBox, shape, axis, 0));
    }
    siliconeVolumeCm3 = Math.max(0, cm3(cavity) - cm3(master));

    if (options.type === 'blockOneWay') {
      // Extend the cavity up through the roof so the box is open on top.
      let open: Solid;
      if (hug) {
        const lo = cavityBox.min.clone();
        lo.setComponent(p, cavityBox.max.getComponent(p));
        const s = cavityBox.getSize(new THREE.Vector3());
        s.setComponent(p, wall * 6 + margin);
        open = cavity.add(Manifold.cube([s.x, s.y, s.z], false).translate([lo.x, lo.y, lo.z]));
      } else {
        const tall = cavityBox.clone();
        tall.max.setComponent(p, tall.max.getComponent(p) + wall * 6);
        open = createMoldBoxManifold(wasm, computeMoldEnvelope(tall, shape, axis, 0));
      }
      pieces.push(outer.subtract(open));
      labels.push('pour_box');
    } else {
      let shell = outer.subtract(cavity);
      if (hug) {
        hugCavity = cavity;
        if ((extras.flangeMm ?? 0) > 0) {
          const fl = flat ? buildPartingFlange(wasm, outer, axis, splitAt(cavityBox), extras.flangeMm!, flangeThickness) : null;
          if (fl) { shell = shell.add(fl); flangeT = flangeThickness; }
          else notices.push(flat
            ? 'The parting flange could not be built for this shape, so it was left off.'
            : 'The parting flange needs a flat, untilted split, so it was left off.');
        }
      }
      shell = drillPour(shell, env, cavityBox);
      pieces.push(...splitWithLocks(shell, env, cavityBox));
      labels.push('box_top', 'box_bottom');
      if (extras.partingBoard) {
        const board = flat
          ? partingBoard(wasm, cavity, offsetOutward(wasm, master, clearance, boundingBox), axis, splitAt(cavityBox),
              lateralCentre, 3, Math.max(2.5, Math.min(5, margin * 0.35)), clearance)
          : null;
        if (board) {
          pieces.push(board.board);
          labels.push('parting_board');
          if (board.keys < 4) notices.push(board.keys === 0
            ? 'The parting board has no key bumps: the silicone around the model is too thin. Increase the silicone margin.'
            : `Only ${board.keys} of 4 key bumps fit on the parting board. Increase the silicone margin for more.`);
        } else {
          notices.push(flat
            ? 'The parting board could not be built for this shape, so it was left out.'
            : 'The parting board needs a flat, untilted split, so it was left out.');
        }
      }
    }
  } else {
    // Skin + mother mold.
    const skin = options.skinThicknessMm ?? defaultSkin(longest);
    const skinOuter = offsetOutward(wasm, master, skin, boundingBox);
    siliconeVolumeCm3 = Math.max(0, cm3(skinOuter) - cm3(master));
    const shellBox = boundingBox.clone().expandByScalar(skin + wall * 0.5);
    let env = computeMoldEnvelope(shellBox, shape, axis, wall);
    let mother: Solid;
    if (hug) {
      const sp = splitAt(shellBox);
      const rimW = Math.max(1.5, skin * 0.5);
      const rim = flat ? skinRim(wasm, skinOuter, axis, sp, rimW, Math.max(2, skin * 0.6)) : null;
      const skinSolid = rim ? skinOuter.add(rim) : skinOuter;
      if (!rim) notices.push(flat
        ? 'The skin registration rim could not be built for this shape, so it was left off.'
        : 'The skin registration rim needs a flat, untilted split, so it was left off.');
      const outer = offsetOutward(wasm, master, skin + wall + (rim ? rimW : 0), boundingBox);
      env = envelopeAroundManifold(outer, axis, wall);
      mother = outer.subtract(skinSolid);
      hugCavity = skinSolid;
      if ((extras.flangeMm ?? 0) > 0) {
        const fl = flat ? buildPartingFlange(wasm, outer, axis, sp, extras.flangeMm!, flangeThickness) : null;
        if (fl) { mother = mother.add(fl); flangeT = flangeThickness; }
        else notices.push('The parting flange needs a flat, untilted split, so it was left off.');
      }
    } else {
      mother = createMoldBoxManifold(wasm, env).subtract(skinOuter);
    }
    mother = drillPour(mother, env, shellBox);
    pieces.push(...splitWithLocks(mother, env, shellBox));
    labels.push('mother_top', 'mother_bottom');
    if (options.includeCore !== false) { pieces.push(master); labels.push('core'); }
  }

  let outPieces = pieces;
  let outLabels = labels;
  const env = lastEnv as MoldEnvelope | null;
  if ((extras.radialSegments ?? 0) >= 3 && env) {
    const center = env.moldMin.clone().addScaledVector(env.moldSize, 0.5);
    const cut = pieces.map((_, i) => i).filter(i => labels[i] !== 'core');
    const r = applyRadialSplit(cut.map(i => pieces[i]), { axis, center, segments: extras.radialSegments! });
    outPieces = r.pieces;
    outLabels = r.pieces.map((_: Solid, k: number) => `${labels[cut[r.sourceIndex[k]!]!]}_r${r.segmentIndex[k]! + 1}`);
    pieces.forEach((s, i) => { if (labels[i] === 'core') { outPieces.push(s); outLabels.push('core'); } });
  }

  return {
    pieces: outPieces.map(s => manifoldToGeometry(s)),
    labels: outLabels,
    repairs,
    siliconeVolumeCm3,
    ...(notices.length ? { notices } : {}),
  };
}
