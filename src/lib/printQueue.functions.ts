import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Workshop print queue: appends one mold job to the Sirpam print-farm
 * spreadsheet through the Google Sheets connector gateway.
 *
 * Sign-in required — the sheet is an internal production queue, so an
 * anonymous endpoint would let anyone fill it with junk rows.
 */
const schema = z.object({
  customer: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(3).max(160),
  project: z.string().trim().max(160).default(""),
  moldType: z.string().trim().max(80).default(""),
  size: z.string().trim().max(80).default(""),
  pieces: z.number().int().min(0).max(999).default(0),
  copies: z.number().int().min(1).max(999).default(1),
  material: z.string().trim().max(60).default(""),
  volumeCm3: z.number().min(0).max(1e6).default(0),
  estCost: z.string().trim().max(60).default(""),
  notes: z.string().trim().max(1000).default(""),
});

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function orderRef() {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}`.slice(2)
    + `${d.getUTCMonth() + 1}`.padStart(2, "0")
    + `${d.getUTCDate()}`.padStart(2, "0");
  return `SPM-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const addPrintJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const sheetsKey = process.env["GOOGLE_SHEETS_API_KEY"];
    const sheetId = process.env["PRINT_QUEUE_SHEET_ID"];
    if (!lovableKey || !sheetsKey || !sheetId) {
      return { ok: false as const, error: "The workshop queue is not set up yet. Please contact us directly." };
    }

    const ref = orderRef();
    const row = [
      new Date().toISOString().replace("T", " ").slice(0, 16),
      "In Queue",
      ref,
      data.customer,
      data.contact,
      data.project,
      data.moldType,
      data.size,
      data.pieces || "",
      data.copies,
      data.material,
      data.volumeCm3 ? data.volumeCm3.toFixed(1) : "",
      data.estCost,
      data.notes,
    ];

    const res = await fetch(
      `${GATEWAY}/spreadsheets/${sheetId}/values/Queue!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": sheetsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [row] }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`Print queue append failed [${res.status}]: ${body}`);
      return { ok: false as const, error: "We could not add your job to the queue just now. Please try again in a minute." };
    }

    return { ok: true as const, ref };
  });
