// Sirpam 3D Labs Mold — shared Studio types.

/** World axis the parting plane is perpendicular to. */
export type Axis = 'x' | 'y' | 'z';

/** Outer shape of the mold block. */
export type MoldBoxShape = 'rect' | 'cylinder' | 'roundedRect';

/** Silicone workflows: open one-piece block, two-part block, or brushed skin with a rigid jacket. */
export type SiliconeMoldType = 'blockOneWay' | 'blockTwoPart' | 'skinCore';

/** Print the mold directly (rigid) or print a box to pour silicone into. */
export type MoldMode = 'rigid' | 'silicone';
