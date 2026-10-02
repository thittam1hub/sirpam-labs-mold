import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from '@tanstack/react-router';
import { colors, radii, spacing, fontSizes, shadows, fonts } from '../../theme';
import { supabase } from '@/integrations/supabase/client';
import { getCreditStatus, CREDITS_EVENT, LOW_BALANCE, EXPIRY_WARN_DAYS, daysUntilExpiry, type CreditStatus } from '@/lib/credits';
import { useAppSession } from '@/components/AppSession';
import { ChevronDown, Menu } from 'lucide-react';
import { ReportIssue } from '@/components/ReportIssue';


type Fmt = 'stl' | 'obj' | '3mf' | 'step';

interface Props {
  fileName: string | null;
  hasModel: boolean;
  hasMold: boolean;
  generateLabel: string;
  generateDisabled: boolean;
  stepExporting: boolean;
  onOpen: () => void;
  onSample: () => void;
  onProjects: () => void;
  onHelp: () => void;
  onGenerate: () => void;
  onExport: (f: Fmt) => void;
}

const pill = (primary = false, disabled = false) => ({
  padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.pill, border: 'none',
  cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit',
  background: primary ? colors.primary : colors.sectionBg,
  color: primary ? '#fff' : colors.textBody,
  boxShadow: disabled ? 'none' : primary ? shadows.primary : shadows.raisedSm,
  opacity: disabled ? 0.5 : 1, fontWeight: 600, fontSize: fontSizes.sm,
});

export default function TopBar(p: Props) {
  const [menu, setMenu] = useState<null | 'export' | 'more' | 'account'>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const { session, ready, signOut: appSignOut } = useAppSession();
  const ref = useRef<HTMLDivElement>(null);

  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [profile, setProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  useEffect(() => {
    if (!session) { setCredits(null); return; }
    const load = () => getCreditStatus().then(setCredits).catch(() => {});
    load();
    window.addEventListener(CREDITS_EVENT, load);
    return () => window.removeEventListener(CREDITS_EVENT, load);
  }, [session]);
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let alive = true;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", session.user.id).maybeSingle()
      .then(async ({ data }) => {
        if (!alive || !data) return;
        let url: string | null = null;
        if (data.avatar_url) {
          const s = await supabase.storage.from("avatars").createSignedUrl(data.avatar_url, 60 * 60);
          url = s.data?.signedUrl ?? null;
        }
        if (alive) setProfile({ display_name: data.display_name ?? "", avatar_url: url });
      });
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(null); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const signOut = async () => {
    setMenu(null);
    await appSignOut();
  };

  const menuBox = {
    position: 'absolute' as const, top: 'calc(100% + 8px)', right: 0, zIndex: 40, minWidth: 200,
    background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raised, padding: spacing.sm,
    display: 'flex', flexDirection: 'column' as const, gap: 4,
  };
  const item = { ...pill(), boxShadow: 'none', textAlign: 'left' as const, borderRadius: radii.md };
  const linkItem = { ...item, textDecoration: 'none' as const, display: 'block' as const };

  const email = session?.user?.email ?? '';
  const shownName = profile?.display_name?.trim() || email;
  const accountLabel = shownName.length > 22 ? shownName.slice(0, 20) + '…' : shownName || 'Account';

  return (
    <header ref={ref} className="sirpam-topbar" style={{
      display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px`,
      background: colors.panelBg, boxShadow: shadows.raisedSm, zIndex: 20, fontFamily: fonts.body, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flexShrink: 0 }}>
        <img src="/logo.svg" alt="Sirpam logo" width={30} height={30} style={{ width: 30, height: 30, borderRadius: '50%', boxShadow: shadows.raisedSm, objectFit: 'cover' }} />
        <h1 className="sirpam-hide-sm" style={{ margin: 0, fontFamily: fonts.display, fontWeight: 700, fontSize: fontSizes.lg, color: colors.textPrimary, whiteSpace: 'nowrap' }}>
          Sirpam <span style={{ color: colors.primary }}>3D Labs</span> Mold
        </h1>
      </div>
      {p.fileName && (
        <span className="sirpam-hide-sm" style={{ fontSize: fontSizes.sm, color: colors.textDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          / {p.fileName}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <div className="sirpam-hide-sm" style={{ display: 'flex', gap: spacing.sm }}>
        <button type="button" style={pill()} onClick={p.onOpen}>Open model</button>
        <button type="button" style={pill()} onClick={p.onSample}>Try sample</button>
        <button type="button" style={pill()} onClick={p.onProjects}>Projects</button>
        <Link to="/shop" style={{ ...pill(), textDecoration: 'none' }}>Shop</Link>
        <Link to="/gallery" search={{ sort: 'new' }} style={{ ...pill(), textDecoration: 'none' }}>Gallery</Link>
        <button type="button" style={pill()} onClick={p.onHelp} aria-label="Keyboard shortcuts">?</button>
        <ThemeToggle style={{ ...pill(), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }} className="" />
      </div>
      {ready && (session ? (
        <div style={{ position: 'relative', display: 'flex', gap: spacing.sm }}>
          {credits && (
            <Link to="/account" search={{ tab: 'credits' }} className="sirpam-hide-sm" title={`${credits.balance} credits + ${credits.monthlyFreeLeft} free this month`}
              style={{ ...pill(), textDecoration: 'none', color: colors.primary }}>
              {credits.balance + credits.monthlyFreeLeft} credits
            </Link>
          )}
          {credits && credits.balance + credits.monthlyFreeLeft <= LOW_BALANCE && (
            <Link to="/pricing" className="sirpam-hide-sm" title="You're running low on credits"
              style={{ ...pill(), textDecoration: 'none', background: colors.primary, color: '#fff' }}>
              Low — buy credits
            </Link>
          )}
          {credits && (() => {
            const d = daysUntilExpiry(credits);
            return d !== null && d >= 0 && d <= EXPIRY_WARN_DAYS ? (
              <Link to="/account" search={{ tab: 'credits' }} className="sirpam-hide-sm"
                title={`${credits.nextExpiryAmount} credits expire on ${new Date(credits.nextExpiryAt!).toLocaleDateString()}`}
                style={{ ...pill(), textDecoration: 'none', color: colors.primary }}>
                {credits.nextExpiryAmount} expire {d === 0 ? 'today' : `in ${d}d`}
              </Link>
            ) : null;
          })()}
          <button type="button" style={{ ...pill(), display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setMenu(menu === 'account' ? null : 'account')} aria-haspopup="menu" className="sirpam-hide-sm">
            {profile?.avatar_url && (
              <img src={profile.avatar_url} alt="" width={20} height={20}
                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            {accountLabel} <ChevronDown aria-hidden="true" size={14} />
          </button>
          {menu === 'account' && (
            <div role="menu" style={menuBox}>
              {credits && <div style={{ ...item, cursor: 'default' }}>{credits.balance} credits · {credits.monthlyFreeLeft} free this month</div>}
              <Link role="menuitem" to="/account" search={{ tab: 'profile' }} style={linkItem}>Profile</Link>
              <Link role="menuitem" to="/pricing" style={linkItem}>Buy credits</Link>
              <Link role="menuitem" to="/gallery" search={{ sort: 'new' }} style={linkItem}>Gallery</Link>
              <button role="menuitem" type="button" style={item} onClick={() => { setMenu(null); setReportOpen(true); }}>Report a problem</button>
              <button role="menuitem" type="button" style={item} onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      ) : (
        <Link to="/auth" search={{ redirect: '/studio' }} style={{ ...pill(), textDecoration: "none" }} className="sirpam-hide-sm">Sign in</Link>
      ))}
      <div className="sirpam-show-sm" style={{ position: 'relative' }}>
        <button type="button" style={{ ...pill(), display: 'grid', placeItems: 'center' }} onClick={() => setMenu(menu === 'more' ? null : 'more')} aria-label="More actions">
          <Menu aria-hidden="true" size={18} />
        </button>
        {menu === 'more' && (
          <div style={menuBox}>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onOpen(); }}>Open model</button>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onSample(); }}>Try sample</button>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onProjects(); }}>Projects</button>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onHelp(); }}>Keyboard shortcuts</button>
            <button type="button" style={item} onClick={() => { setMenu(null); setReportOpen(true); }}>Report a problem</button>
            <Link to="/shop" style={linkItem}>Shop</Link>
            <Link to="/gallery" search={{ sort: 'new' }} style={linkItem}>Gallery</Link>
            {session ? (
              <>
                <Link to="/account" search={{ tab: 'profile' }} style={linkItem}>{accountLabel}</Link>
                <button type="button" style={item} onClick={signOut}>Sign out</button>
              </>
            ) : (
              <Link to="/auth" search={{ redirect: '/studio' }} style={linkItem}>Sign in</Link>
            )}
          </div>
        )}
      </div>
      <button type="button" style={pill(true, p.generateDisabled || !p.hasModel)}
        disabled={p.generateDisabled || !p.hasModel} onClick={p.onGenerate}>
        {p.generateLabel}
      </button>
      <div style={{ position: 'relative' }}>
        <button type="button" style={pill(false, !p.hasMold)} disabled={!p.hasMold}
          onClick={() => setMenu(menu === 'export' ? null : 'export')} aria-haspopup="menu">
          Export <ChevronDown aria-hidden="true" size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </button>
        {menu === 'export' && (
          <div role="menu" style={menuBox}>
            {([['stl', 'STL'], ['obj', 'OBJ'], ['3mf', '3MF'], ['step', 'STEP (CAD)']] as const).map(([f, l]) => (
              <button key={f} role="menuitem" type="button" style={item} disabled={p.stepExporting}
                onClick={() => { setMenu(null); p.onExport(f); }}>
                {f === 'step' && p.stepExporting ? 'Exporting STEP…' : l}
              </button>
            ))}
          </div>
        )}
      </div>
      <ReportIssue open={reportOpen} onOpenChange={setReportOpen} hideTrigger />
    </header>
  );
}
