import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import type { MoldMode } from '../types';
import { solidProps, CASTING_MATERIALS, type CastingMaterialId } from '../utils/tier2';
import { addPrintJob } from '@/lib/printQueue.functions';
import { useAppSession } from '@/components/AppSession';
import { BUSINESS } from '@/lib/business';
import { trackEvent } from '@/components/Analytics';

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
export function PrintQueuePanel({ pieces, fileName, moldMode, material, pricePerKg, siliconeVolumeCm3, castingMaterial, cavities }: {
  pieces: THREE.BufferGeometry[];
  fileName: string;
  moldMode: MoldMode;
  material: 'pla' | 'resin';
  pricePerKg: number;
  siliconeVolumeCm3?: number;
  castingMaterial?: CastingMaterialId;
  cavities?: number;
}) {
  const { session, ready } = useAppSession();
  const submit = useServerFn(addPrintJob);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [city, setCity] = useState('');
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
  const castMat = CASTING_MATERIALS.find(m => m.id === castingMaterial);
  const castCopies = Math.max(1, cavities ?? 1);

  // Indian mobile: optional +91/0 prefix, then 10 digits starting 6-9. PIN: 6 digits, not starting with 0.
  const mobile = phone.replace(/[\s-]/g, '').replace(/^(\+?91|0)/, '');
  const phoneOk = /^[6-9]\d{9}$/.test(mobile);
  const pinOk = /^[1-9]\d{5}$/.test(pin);
  const canSend = !!customer.trim() && phoneOk && pinOk && !!city.trim();

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await submit({
        data: {
          customer: customer.trim(),
          contact: `+91 ${mobile} | ${city.trim()} ${pin}`,
          project: fileName.replace(/\.[^.]+$/, '') || 'Untitled model',
          moldType: moldMode === 'silicone' ? 'Silicone mold with printed box' : 'Printed rigid mold',
          size: specs.size,
          pieces: pieces.length,
          copies,
          material: matLabel,
          volumeCm3: specs.volume * copies,
          estCost: `Rs ${(cost * copies).toFixed(0)}`,
          notes: notes.trim() + (siliconeVolumeCm3 ? ` | silicone ~${(siliconeVolumeCm3 / 1000).toFixed(2)} L` : ''),
        },
      });
      if (!r.ok) { setErr(r.error); return; }
      setRef(r.ref);
      trackEvent('quote_requested', { pieces: pieces.length, copies, silicone: moldMode === 'silicone' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send your job right now.');
    } finally { setBusy(false); }
  };

  const waMsg = ref
    ? `Hi Sirpam 3D Labs, my mold order ${ref}: ${pieces.length} pieces, ${specs.size} mm, ${matLabel}, ${copies} set(s). Delivery PIN ${pin}.`
    : `Hi Sirpam 3D Labs, I designed a mold in your studio and would like it printed:\n` +
      `• Project: ${fileName.replace(/\.[^.]+$/, '') || 'Untitled model'}\n` +
      `• Mold: ${moldMode === 'silicone' ? 'Silicone mold + printed box' : 'Printed rigid mold'}, ${pieces.length} piece(s)\n` +
      `• Size: ${specs.size} mm · about ${specs.volume.toFixed(1)} cm³ of print material\n` +
      (castMat ? `• Casting: ${castMat.label}${copies > 1 ? ` × ${copies} copies per mold` : ''}\n` : '') +
      (siliconeVolumeCm3 ? `• Silicone needed: ~${(siliconeVolumeCm3 / 1000).toFixed(2)} L\n` : '') +
      `\nCould you tell me the price and delivery time?`;
  const waText = encodeURIComponent(waMsg);
  const estimate = Math.round(cost * copies);

  return (
    <div style={s.section} id="sirpam-print-queue">
      <div style={s.title}>Order this mold printed</div>
      <div style={{ ...s.hint, marginTop: 0, marginBottom: spacing.xs }}>We print and deliver within India only.</div>
      <div style={s.kv}><span>Mold type</span><span>{moldMode === 'silicone' ? 'Silicone + box' : 'Rigid printed'}</span></div>
      <div style={s.kv}><span>Pieces</span><span>{pieces.length}</span></div>
      <div style={s.kv}><span>Overall size</span><span>{specs.size} mm</span></div>
      <div style={s.kv}><span>Material per set</span><span>{specs.volume.toFixed(1)} cm3</span></div>
      {castMat && <div style={s.kv}><span>Casting</span><span>{castMat.label}{copies > 1 ? ` × ${copies}` : ''}</span></div>}
      {estimate > 0 && <div style={s.kv}><span>Material estimate</span><span>Rs {estimate.toLocaleString("en-IN")}</span></div>}
      <div style={s.hint}>{estimate > 0
        ? "Guide only — excludes GST, labour and delivery. We confirm the final price before printing. Nothing is charged here."
        : "Add your material price in the estimator to see a cost guide here. We always confirm the final price (incl. GST, labour and delivery) before printing. Nothing is charged here."}</div>

      {ready && !session && (
        <div style={s.hint}>
          <Link to="/auth" search={{ redirect: '/studio' }} style={{ color: colors.primary, fontWeight: 600 }}>Sign in</Link> to send this mold to our workshop.
        </div>
      )}

      {ready && session && !ref && (<>
        <input style={s.input} value={customer} maxLength={120} aria-label="Your name" placeholder="Your name"
          autoComplete="name" onChange={e => setCustomer(e.target.value)} />
        <input style={s.input} value={phone} maxLength={16} inputMode="tel" autoComplete="tel" aria-label="WhatsApp mobile number"
          placeholder="WhatsApp mobile (10 digits)" onChange={e => setPhone(e.target.value)} />
        {phone && !phoneOk && <div style={s.hint}>Enter a 10-digit Indian mobile number.</div>}
        <div style={{ display: 'flex', gap: spacing.xs }}>
          <input style={s.input} value={city} maxLength={60} autoComplete="address-level2" aria-label="City" placeholder="City"
            onChange={e => setCity(e.target.value)} />
          <input style={s.input} value={pin} maxLength={6} inputMode="numeric" autoComplete="postal-code" aria-label="PIN code"
            placeholder="PIN code" onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        </div>
        {pin.length === 6 && !pinOk && <div style={s.hint}>That PIN code doesn't look right.</div>}
        <label style={{ ...s.hint, display: 'block' }}>How many mold sets?
          <input style={s.input} type="number" min={1} max={999} value={copies} aria-label="Number of mold sets"
            onChange={e => setCopies(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))} />
        </label>
        <textarea style={{ ...s.input, minHeight: 56, resize: 'vertical' }} value={notes} maxLength={1000}
          aria-label="Notes for the workshop" placeholder="Colour, finish, needed-by date, GSTIN for a business invoice"
          onChange={e => setNotes(e.target.value)} />
        <button type="button" style={s.btn} disabled={busy || !canSend} onClick={send}>
          {busy ? 'Sending…' : 'Request a quote'}
        </button>
        <div style={s.hint}>We reply on WhatsApp within 1 working day with the final price (incl. GST), a payment link and the delivery date.</div>
      </>)}

      {ref && (<>
        <div style={{ ...s.hint, color: colors.primary, fontWeight: 600 }} role="status">
          Quote requested — your reference is {ref}. We will message you on WhatsApp.
        </div>
        {BUSINESS.whatsapp && (
          <a href={`https://wa.me/${BUSINESS.whatsapp}?text=${waText}`} target="_blank" rel="noopener noreferrer"
            onClick={() => trackEvent('whatsapp_contact_clicked', { stage: 'after_order' })}
            style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Chat with us on WhatsApp
          </a>
        )}
      </>)}
      {BUSINESS.whatsapp && !ref && (
        <div style={s.hint} className="text-center">
          Prefer to ask a person first?{" "}
          <a href={`https://wa.me/${BUSINESS.whatsapp}?text=${waText}`} target="_blank" rel="noopener noreferrer"
            onClick={() => trackEvent('whatsapp_contact_clicked', { stage: 'pre_order' })}
            style={{ color: colors.primary, fontWeight: 600 }}>
            Chat with us on WhatsApp
          </a>
        </div>
      )}
      {err && <div role="alert" style={{ ...s.hint, color: colors.primary, fontWeight: 600 }}>{err}</div>}
    </div>
  );
}
