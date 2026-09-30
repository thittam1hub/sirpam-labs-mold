// Sirpam 3D Labs Mold — common printers and their build volumes (from maker spec sheets).

export type PrinterCategory = 'fdm' | 'resin';

export interface PrinterPreset {
  id: string;
  label: string;
  category: PrinterCategory;
  volumeMm: { x: number; y: number; z: number };
}

const fdm = (id: string, label: string, x: number, y: number, z: number): PrinterPreset =>
  ({ id, label, category: 'fdm', volumeMm: { x, y, z } });
const resin = (id: string, label: string, x: number, y: number, z: number): PrinterPreset =>
  ({ id, label, category: 'resin', volumeMm: { x, y, z } });

export const PRINTER_PRESETS: readonly PrinterPreset[] = [
  fdm('bambu-a1', 'Bambu A1 / A1 mini (256 or 180)', 256, 256, 256),
  fdm('bambu-a1-mini', 'Bambu A1 mini (180³)', 180, 180, 180),
  fdm('bambu-x1c', 'Bambu X1C / P1S (256³)', 256, 256, 256),
  fdm('prusa-mk4', 'Prusa MK4 / MK4S (250×210×220)', 250, 210, 220),
  fdm('prusa-mini', 'Prusa Mini+ (180³)', 180, 180, 180),
  fdm('prusa-xl', 'Prusa XL (360³)', 360, 360, 360),
  fdm('ender-3', 'Ender 3 V3 / S1 (220×220×250)', 220, 220, 250),
  // Resin: usable area is a touch under the advertised screen size.
  resin('elegoo-saturn-3', 'Elegoo Saturn 3 Ultra (219×123×260)', 218, 122, 260),
  resin('elegoo-mars-5', 'Elegoo Mars 5 Pro (153×78×165)', 153, 77, 165),
  resin('anycubic-m5s', 'Anycubic Photon M5s (219×123×200)', 218, 122, 200),
];

export const getPresetById = (id: string | null | undefined): PrinterPreset | undefined =>
  id ? PRINTER_PRESETS.find(p => p.id === id) : undefined;
