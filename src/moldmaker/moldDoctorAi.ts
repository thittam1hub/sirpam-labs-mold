// Mold Doctor: deterministic findings from the engine's own checks, optionally
// explained by the browser's built-in on-device model; plus a Co-Pilot that turns
// a sentence into a validated settings change. The model never touches geometry.
import { z } from 'zod';
import type * as THREE from 'three';
import type { Axis } from './types';
import { demoldRisk, airTrapPoints } from './mold/castRisk';

type LM = {
  availability?: (o?: unknown) => Promise<string>;
  create: (o: unknown) => Promise<{ prompt: (t: string) => Promise<string>; destroy?: () => void }>;
};
function api(): LM | null {
  if (typeof window === 'undefined') return null;
  const g = globalThis as unknown as { LanguageModel?: LM; ai?: { languageModel?: LM } };
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}
export async function doctorAiReady(): Promise<boolean> {
  const lm = api();
  if (!lm) return false;
  try { const a = lm.availability ? await lm.availability() : 'available'; return a === 'available' || a === 'readily'; }
  catch { return false; }
}
async function ask(system: string, text: string): Promise<string | null> {
  const lm = api();
  if (!lm) return null;
  try {
    const s = await lm.create({ initialPrompts: [{ role: 'system', content: system }] });
    try { return await s.prompt(text); } finally { s.destroy?.(); }
  } catch { return null; }
}

export interface Finding { level: 'ok' | 'warn' | 'bad'; text: string }

export function diagnose(g: THREE.BufferGeometry, bbox: THREE.Box3, axis: Axis, offset: number, cutAngle: number,
  ctx: { autoVents: boolean; moldMode: string }): Finding[] {
  const r = demoldRisk(g, axis, offset, bbox, cutAngle);
  const traps = airTrapPoints(g, axis, bbox).length;
  const f: Finding[] = [];
  if (r.level === 'low') f.push({ level: 'ok', text: `Release looks clean (risk ${r.score}/100).` });
  else f.push({ level: r.level === 'high' ? 'bad' : 'warn', text: `Demolding risk ${r.score}/100: ${Math.round(r.undercutPct * 100)}% of the surface hooks back into the mold.` });
  if (r.betterAxis) f.push({ level: 'warn', text: `Splitting along ${r.betterAxis.toUpperCase()} would drop the risk to ${r.betterScore}/100.` });
  if (r.dragPct > 0.25) f.push({ level: 'warn', text: `${Math.round(r.dragPct * 100)}% of walls are straight up and down. Add 1–2° draft under Model Tools so the cast slides out.` });
  if (r.level !== 'low' && ctx.moldMode === 'rigid') f.push({ level: 'warn', text: 'A rigid mold cannot flex around hooks. Switch to a silicone mold for this shape.' });
  if (traps) f.push({ level: ctx.autoVents ? 'ok' : 'warn', text: ctx.autoVents ? `${traps} air pocket${traps > 1 ? 's' : ''} found; auto vents will clear them.` : `${traps} high spot${traps > 1 ? 's' : ''} will trap air bubbles. Turn on auto vents.` });
  else f.push({ level: 'ok', text: 'No trapped-air spots found.' });
  return f;
}

export async function explainFindings(f: Finding[]): Promise<string | null> {
  const out = await ask(
    'You are a friendly mold-making workshop expert. Given check results, write 3 short plain-English tips (one per line, no markdown) telling a hobbyist what to do before pouring. Never invent numbers.',
    f.map(x => `- ${x.text}`).join('\n'),
  );
  return out?.trim() || null;
}

export const CopilotPatch = z.object({
  axis: z.enum(['x', 'y', 'z']).optional(),
  moldMode: z.enum(['rigid', 'silicone']).optional(),
  sprueDiameterMm: z.number().min(0).max(20).optional(),
  clearanceMm: z.number().min(0).max(1).optional(),
  autoVents: z.boolean().optional(),
  formFit: z.boolean().optional(),
}).strict();
export type CopilotPatch = z.infer<typeof CopilotPatch>;

/** Rule parser: always works, no model needed. */
export function parseCommandRules(t: string): CopilotPatch {
  const s = t.toLowerCase(), p: CopilotPatch = {};
  const ax = s.match(/\b(?:split|axis|along)\b[^.]*?\b([xyz])\b/); if (ax) p.axis = ax[1] as Axis;
  if (/silicone/.test(s)) p.moldMode = 'silicone'; else if (/rigid|resin mold|print(ed)? mold/.test(s)) p.moldMode = 'rigid';
  const sp = s.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:sprue|pour|spout)|(?:sprue|pour|spout)[^\d]{0,12}(\d+(?:\.\d+)?)\s*mm/);
  if (sp) p.sprueDiameterMm = Math.min(20, Number(sp[1] ?? sp[2]));
  else if (/auto (sprue|pour)/.test(s)) p.sprueDiameterMm = 0;
  const cl = s.match(/(\d*\.?\d+)\s*mm\s*(?:gap|clearance|tolerance)|(?:gap|clearance|tolerance)[^\d]{0,12}(\d*\.?\d+)\s*mm/);
  if (cl) p.clearanceMm = Math.min(1, Number(cl[1] ?? cl[2]));
  if (/no vents?|without vents?|vents? off/.test(s)) p.autoVents = false; else if (/vent/.test(s)) p.autoVents = true;
  if (/(hug|form[- ]?fit)/.test(s)) p.formFit = !/no (hug|form)/.test(s);
  return p;
}

export async function parseCommand(t: string): Promise<{ patch: CopilotPatch; via: 'device' | 'rules' }> {
  const raw = await ask(
    'Convert the mold request into JSON with only these optional keys: axis ("x"|"y"|"z"), moldMode ("rigid"|"silicone"), sprueDiameterMm (0-20, 0=auto), clearanceMm (0-1), autoVents (bool), formFit (bool). Omit anything not mentioned. Reply with ONLY the JSON.',
    t,
  );
  const m = raw?.match(/\{[\s\S]*\}/);
  if (m) {
    try { const r = CopilotPatch.safeParse(JSON.parse(m[0])); if (r.success && Object.keys(r.data).length) return { patch: r.data, via: 'device' }; } catch { /* fall back */ }
  }
  return { patch: parseCommandRules(t), via: 'rules' };
}

export function describePatch(p: CopilotPatch): string[] {
  const o: string[] = [];
  if (p.axis) o.push(`Split along ${p.axis.toUpperCase()}`);
  if (p.moldMode) o.push(p.moldMode === 'silicone' ? 'Silicone mold' : 'Rigid printed mold');
  if (p.sprueDiameterMm !== undefined) o.push(p.sprueDiameterMm === 0 ? 'Pour hole: auto size' : `Pour hole ${p.sprueDiameterMm} mm`);
  if (p.clearanceMm !== undefined) o.push(`Fit gap ${p.clearanceMm} mm`);
  if (p.autoVents !== undefined) o.push(p.autoVents ? 'Auto vents on' : 'Auto vents off');
  if (p.formFit !== undefined) o.push(p.formFit ? 'Hug-shape shell on' : 'Hug-shape shell off');
  return o;
}
