// Sirpam 3D Labs Mold — slider bounds for the mold-dimension controls.
// Wall thickness stays ratio-based (source of truth for a dozen derived
// values); clearance and sprue diameter are absolute mm per roadmap #13.
export const WALL_THICKNESS_MIN = 0.03;
export const WALL_THICKNESS_MAX = 0.20;
export const CLEARANCE_MIN_MM = 0.05;
export const CLEARANCE_MAX_MM = 1.0;
export const CLEARANCE_STEP_MM = 0.05;
export const SPRUE_DIAMETER_MIN_MM = 4;
export const SPRUE_DIAMETER_MAX_MM = 25;
export const SPRUE_DIAMETER_STEP_MM = 0.5;
