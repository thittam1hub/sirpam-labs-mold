// Sirpam 3D Labs Mold — engine defaults.
// Proportions are relative to the model's largest dimension unless the name
// says MM. These are the shop defaults every new mold starts from.

/** Mold wall as a fraction of the model's largest side. */
export const WALL_THICKNESS_RATIO = 0.08;
/** Gap between model and cavity so the cast releases (mm). */
export const CLEARANCE_MM = 0.2;
/** Pour hole diameter (mm). */
export const SPRUE_DIAMETER_MM = 10;

/** Alignment pins, as fractions of the wall thickness. */
export const PIN_RADIUS_RATIO = 0.2;
export const PIN_HEIGHT_RATIO = 0.6;
/** How far pins sit in from the outer corner, as a fraction of the wall. */
export const PIN_INSET_RATIO = 0.5;

/** Pour funnel mouth = sprue radius x this. */
export const SPRUE_TOP_MULTIPLIER = 2.0;

/** Air vents: radius as a fraction of the sprue radius, and funnel flare. */
export const VENT_RADIUS_RATIO = 0.35;
export const VENT_TAPER_RATIO = 1.2;
/** Minimum distance between vents, as a fraction of the model's largest side. */
export const VENT_MIN_SPACING_RATIO = 0.3;
/** Upper bound on surface points examined when picking vent spots. */
export const VENT_CANDIDATE_SAMPLE_CAP = 2000;
export const MAX_VENTS = 4;
export const MIN_VENTS = 2;

/** Vertices closer than this are treated as the same point when welding. */
export const MERGE_TOLERANCE = 1e-5;

/** Exploded view: pieces move apart by this fraction of the model size. */
export const EXPLODE_OFFSET_RATIO = 0.3;

/** Angled (tilted) splits are available in the UI. */
export const ENABLE_OBLIQUE_PLANES = true;

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

/** Console logging that only runs in development builds. */
export function dbg(...args: unknown[]): void {
  if (IS_DEV) console.log(...args);
}
