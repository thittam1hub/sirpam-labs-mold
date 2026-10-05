// Plain display names for engine piece labels (export file names stay as-is).
const NAMES: Record<string, string> = {
  base_plate: 'Base plate', box_walls: 'Box walls', frame_bottom: 'Bottom frame', frame_top: 'Top frame',
  parting_board: 'Parting board', pour_rods: 'Pour rods', mother_top: 'Mother mold top',
  mother_bottom: 'Mother mold bottom', core: 'Model', top: 'Top half', bottom: 'Bottom half',
};

export function pieceDisplayName(label: string | undefined, i: number): string {
  if (!label) return `Piece ${i + 1}`;
  const m = label.match(/^(.*)_r(\d+)$/);
  const base = m ? m[1]! : label;
  const name = NAMES[base] ?? base.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  return m ? `${name} (segment ${m[2]})` : name;
}
