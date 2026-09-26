const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export const SHAPE_INSTRUCTIONS = `You design simple, castable solid objects for a mold-making app. Reply with ONLY one JSON object, no prose, no code fences. Units are millimetres. Z is up. Pick ONE kind:

1) Round objects (vases, cups, candles, chess pieces, bottles, bowls):
{"kind":"lathe","name":string,"profile":[[radius,height],...]}
 - profile is the right half of the silhouette, from bottom centre (radius 0) up the outside and back to the axis at the top (radius 0). 8-60 points, radius >= 0, heights increasing then ending at the top.

2) Flat shapes (cookie/chocolate shapes, pendants, coasters, logos, signs, soap bars from a photo outline):
{"kind":"extrude","name":string,"outline":[[x,y],...],"holes":[[[x,y],...]],"height":number}
 - outline is a closed, non-self-intersecting polygon, 8-120 points, counter-clockwise. holes optional.

3) Objects built from primitives (toys, figurines, simple parts):
{"kind":"compound","name":string,"parts":[{"shape":"box"|"sphere"|"cylinder"|"cone","size":[x,y,z],"pos":[x,y,z],"rot":[x,y,z],"op":"add"|"subtract"}]}
 - size = full box dimensions; sphere uses size[0] as diameter; cylinder/cone size [diameter,diameter,height] (cone tip at top). rot in degrees. 1-30 parts, all "add" parts must touch so the result is one piece.

Rules: overall size 20-150 mm unless the user gives a size. No thin features under 2 mm. No undercut-heavy overhangs if avoidable. If a photo is given, trace its main object's silhouette.`;

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function generateShapeJson(apiKey: string, prompt: string, imageDataUrl?: string): Promise<string> {
  const content: Record<string, unknown>[] = [{ type: "input_text", text: prompt || "Trace the main object in this photo." }];
  if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl });
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      instructions: SHAPE_INSTRUCTIONS,
      input: [{ role: "user", content }],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = "";
    try { msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? ""; } catch { /* not json */ }
    if (res.status === 402) throw new AiError(msg || "AI credits have run out. Add credits in Settings → Plans & credits.", 402);
    if (res.status === 429) throw new AiError("Too many AI requests right now — wait a minute and try again.", 429);
    if (res.status === 403) throw new AiError(msg || "AI access is blocked for this workspace.", 403);
    throw new AiError(msg || `AI request failed (${res.status}).`, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let ev: any;
      try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      else if (ev.type === "error" || ev.type === "response.failed") {
        throw new AiError(ev.error?.message ?? ev.response?.error?.message ?? "The AI could not finish.", 502);
      }
    }
  }
  if (!text.trim()) throw new AiError("The AI declined or returned nothing. Try describing the object differently.", 422);
  return text;
}
