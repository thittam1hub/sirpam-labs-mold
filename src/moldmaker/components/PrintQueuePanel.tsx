import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import type { MoldMode } from '../types';
import { solidProps } from '../utils/tier2';
import { addPrintJob } from '@/lib/printQueue.functions';
import { useAppSession } from '@/components/AppSession';

const s = {
  section: { background: colors.sectionBg, borderRadius: radii.xl, padding: spacing.md + 4, boxShadow: shadows.raised },
  title: { fontSize: fontSizes.sm, fontWeight: 600, color: colors.textDim, marginBottom: spacing.sm + 2, textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  hint: { fontSize: fontSizes.xs, color: colors.textDim, lineHeight: 1.4, marginTop: spacing.xs },
  kv: { display: 'flex', justifyContent: 'space-between', fontSize: fontSizes.sm, color: colors.textBody, padding: '2px 0' },
  input: {
    width: '100%', marginTop: spacing.xs, padding: `${spacing.xs + 2}px ${spacing.sm}px`, borderRadius: radii.md, border: 'none', fontFamily: 'inherit',
    background: colors.sectionBg, boxShadow: shadows.inset, color: colors.textBody, fontSize: fontSizes.sm,
  },
  btn: {
    width: '100%', marginTop: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.pill, border: 'none', cursor: 'pointer',
    background: colors.sectionBg, color: colors.textBody, boxShadow: shadows.raisedSm, fontWeight: 600, fontSize: fontSizes.sm, fontFamily: 'inherit',
  },
};

/**
 * Sends the finished mold job to the workshop print queue spreadsheet.
 * Measurements are read from the generated pieces so the shop gets the
 * same numbers the user sees on screen.
 */
export function PrintQueuePanel({ pieces, fileName, moldMode, material, pricePerKg, siliconeVolumeCm3 }: {
  pieces: THREE.BufferGeometry[];
  fileName: string;
  moldMode: MoldMode;
  material: 'pla' | 'resin';
  pricePerKg: number;
  siliconeVolumeCm3?: number;
}) {
  const { session, ready } = useAppSession();
  const submit = useServerFn(addPrintJob);
  const [customer, setCustomer] = useState('');
  const [contact, setContact] = useState('');
  const [copies, setCopies] = useState(1);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  const specs = useMemo(() => {
    if (!pieces.length) return null;
    const box = new THREE.Box3();
    let volume = 0;
    for (const g of pieces) {
      g.computeBoundingBox();
      if (g.boundingBox) box.union(g.boundingBox);
      volume += solidProps(g).volume / 1000; // mm3 -> cm3
    }
    const sz = box.getSize(new THREE.Vector3());
    return {
      size: `${sz.x.toFixed(0)} x ${sz.y.toFixed(0)} x ${sz.z.toFixed(0)}`,
      volume,
    };
  }, [pieces]);

  if (!pieces.length || !specs) return null;

  const density = material === 'resin' ? 1.1 : 1.24;
  const cost = specs.volume * density * pricePerKg / 1000;
  const matLabel = moldMode === 'silicone' ? `${material === 'resin' ? 'Resin' : 'PLA'} box + silicone` : material === 'resin' ? 'Resin' : 'PLA';

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await submit({
        data: {
          customer: customer.trim(),
          contact: contact.trim(),
          project: fileName.replace(/\.[^.]+$/, '') || 'Untitled model',
          moldType: moldMode === 'silicone' ? 'Silicone mold with printed box' : 'Printed rigid mold',
          size: specs.size,
          pieces: pieces.length,
          copies,
          material: matLabel,
          volumeCm3: specs.volume * copies,
          estCost: (cost * copies).toFixed(2),
          notes: notes.trim() + (siliconeVolumeCm3 ? ` | silicone ~${(siliconeVolumeCm3 / 1000).toFixed(2)} L` : ''),
        },
      });
      if (!r.ok) { setErr(r.error); return; }
      setRef(r.ref);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send your job right now.');
    } finally { setBusy(false); }
  };

  return (
    <div style={s.section} id="sirpam-print-queue">
      <div style={s.title}>Order this mold printed</div>
      <div style={s.kv}><span>Mold type</span><span>{moldMode === 'silicone' ? 'Silicone + box' : 'Rigid printed'}</span></div>
      <div style={s.kv}><span>Pieces</span><span>{pieces.length}</span></div>
      <div style={s.kv}><span>Overall size</span><span>{specs.size} mm</span></div>
      <div style={s.kv}><span>Material per set</span><span>{specs.volume.toFixed(1)} cm3</span></div>
      <div style={s.kv}><span>Estimate</span><span>{(cost * copies).toFixed(2)}</span></div>

      {ready && !session && (
        <div style={s.hint}>
          <Link to="/auth" style={{ color: colors.primary, fontWeight: 600 }}>Sign in</Link> to send this mold to our workshop.
        </div>
      )}

      {ready && session && !ref && (<>
        <input style={s.input} value={customer} maxLength={120} aria-label="Your name" placeholder="Your name"
          onChange={e => setCustomer(e.target.value)} />
        <input style={s.input} value={contact} maxLength={160} aria-label="WhatsApp number or email" placeholder="WhatsApp number or email"
          onChange={e => setContact(e.target.value)} />
        <label style={{ ...s.hint, display: 'block' }}>How many mold sets?
          <input style={s.input} type="number" min={1} max={999} value={copies} aria-label="Number of mold sets"
            onChange={e => setCopies(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))} />
        </label>
        <textarea style={{ ...s.input, minHeight: 56, resize: 'vertical' }} value={notes} maxLength={1000}
          aria-label="Notes for the workshop" placeholder="Colour, finish, delivery date, anything else"
          onChange={e => setNotes(e.target.value)} />
        <button type="button" style={s.btn} disabled={busy || !customer.trim() || contact.trim().length < 3} onClick={send}>
          {busy ? 'Sending…' : 'Send to workshop'}
        </button>
        <div style={s.hint}>We add it to our print queue and get back to you with a firm price and timeline. Estimates on this page are guides only.</div>
      </>)}

      {ref && (
        <div style={{ ...s.hint, color: colors.primary, fontWeight: 600 }} role="status">
          Sent — your reference is {ref}. We will contact you on the details you gave.
        </div>
      )}
      {err && <div role="alert" style={{ ...s.hint, color: colors.primary, fontWeight: 600 }}>{err}</div>}
    </div>
  );
}
