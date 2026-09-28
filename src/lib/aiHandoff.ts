import type { ShapeSpec } from "@/lib/shapeAi.functions";

/** Hands an AI-made shape from /studio/ai into the Studio without re-upload. */
const KEY = "sirpam:ai-handoff";

export function setAiHandoff(spec: ShapeSpec, name: string) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ spec, name })); } catch { /* ignore */ }
}

export function takeAiHandoff(): { spec: ShapeSpec; name: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw);
  } catch { return null; }
}
