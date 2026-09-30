// Sirpam 3D Labs Mold — plain-language messages for STEP export problems.

const BY_CODE: Record<string, string> = {
  empty: "There's no mold to export yet. Build the mold first, then export STEP.",
  tooMany: 'This mold is too detailed for STEP. Use STL or 3MF instead (no size limit), or reduce the model detail first.',
  download: "The CAD export engine couldn't download. Check your internet connection and try again (about 66 MB, first time only).",
  badFace: 'One piece has a broken triangle STEP cannot store. Use STL instead, or repair the model in the Model step.',
  sewFailed: "The mold surface couldn't be joined up for STEP (usually gaps or overlaps). Use STL instead, or repair the model first.",
};

/**
 * Turn a raw worker error into something a maker understands.
 * Accepts either a code from StepExportError or a free-text message.
 */
export function translateStepError(raw: string, code?: string): string {
  if (code && BY_CODE[code]) return BY_CODE[code]!;
  if (/cancel/i.test(raw)) return 'STEP export cancelled.';
  if (/memory|RangeError|OOM/i.test(raw)) return 'Ran out of memory making the STEP file. Use STL or 3MF, or reduce the model detail first.';
  if (/crash/i.test(raw)) return 'The CAD export engine stopped unexpectedly. Try again, or use STL/3MF.';
  if (/no triangles/i.test(raw)) return BY_CODE['empty']!;
  if (/limit \d+/.test(raw)) return BY_CODE['tooMany']!;
  if (/download failed/i.test(raw)) return BY_CODE['download']!;
  if (/could not be turned into a face/i.test(raw)) return BY_CODE['badFace']!;
  if (/could not be joined/i.test(raw)) return BY_CODE['sewFailed']!;
  return raw;
}
