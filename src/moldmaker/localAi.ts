// On-device AI tier: Chrome/Edge built-in model (Gemini Nano). Free, private, no download by us.
// Falls back to the cloud path in AiMakerPage when unavailable or when output fails validation.
import { ShapeSpec } from '@/lib/shapeAi.functions';
import { SHAPE_INSTRUCTIONS } from '@/lib/shapePrompt';

type LM = {
  availability?: (o?: unknown) => Promise<string>;
  create: (o: unknown) => Promise<{ prompt: (t: string) => Promise<string>; destroy?: () => void }>;
};

function api(): LM | null {
  if (typeof window === 'undefined') return null;
  const g = globalThis as unknown as { LanguageModel?: LM; ai?: { languageModel?: LM } };
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}

export type LocalStatus = 'ready' | 'downloadable' | 'unsupported';

export async function localAiStatus(): Promise<LocalStatus> {
  const lm = api();
  if (!lm) return 'unsupported';
  try {
    const a = lm.availability ? await lm.availability() : 'available';
    if (a === 'available' || a === 'readily') return 'ready';
    if (a === 'downloadable' || a === 'downloading' || a === 'after-download') return 'downloadable';
  } catch { /* fallthrough */ }
  return 'unsupported';
}

/** Returns a validated spec, or null so the caller can fall back to the cloud. */
export async function generateShapeLocal(prompt: string): Promise<ShapeSpec | null> {
  const lm = api();
  if (!lm) return null;
  const session = await lm.create({ initialPrompts: [{ role: 'system', content: SHAPE_INSTRUCTIONS }] });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await session.prompt(attempt ? `${prompt}\nReply with ONLY the JSON object.` : prompt);
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) continue;
      try {
        const parsed = ShapeSpec.safeParse(JSON.parse(m[0]));
        if (parsed.success) return parsed.data;
      } catch { /* retry */ }
    }
    return null;
  } finally { session.destroy?.(); }
}
