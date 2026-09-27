import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import showcase from "@/assets/mold-showcase.jpg";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Sirpam 3D Labs Mold — turn any 3D model into a print-ready mold" },
      {
        name: "description",
        content:
          "Free browser-based mold maker: upload an STL or OBJ, get a suggested parting plane, auto sprues, vents and pins, and export print-ready two-part mold halves. Nothing leaves your computer.",
      },
      { property: "og:title", content: "Sirpam 3D Labs Mold — turn any 3D model into a print-ready mold" },
      {
        property: "og:description",
        content:
          "Upload an STL, get a print-ready two-part mold with auto sprues, vents and pins. Runs entirely in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    title: "Smart parting plane",
    body: "The app suggests the best place to split your model and previews the split line in 3D before you commit.",
    icon: "✂️",
  },
  {
    title: "Sprues, vents & pins",
    body: "Pour hole, air vents and registration pins are generated automatically — no CAD work needed.",
    icon: "💧",
  },
  {
    title: "Curved & multi-part molds",
    body: "Curved split lines for shapes that won't pull straight out, plus 3- or 4-piece molds for wide models.",
    icon: "🔄",
  },
  {
    title: "Auto-repair broken STLs",
    body: "Holes and broken spots in your mesh are fixed automatically, so the mold still builds.",
    icon: "🩹",
  },
  {
    title: "Material & cost estimator",
    body: "See how much casting material to mix and what the print will cost before you print.",
    icon: "⚗️",
  },
  {
    title: "Print-farm planner",
    body: "Making many molds? Find out how many printer plates you need and what each mold costs.",
    icon: "🏭",
  },
];

const STEPS = [
  { n: 1, title: "Upload your model", body: "Drop in an STL or OBJ file — or describe the shape and let the AI model maker build it." },
  { n: 2, title: "Pick the split", body: "Drag the suggested parting plane, preview the split line, and choose your mold options." },
  { n: 3, title: "Generate the mold", body: "Two (or more) mold halves with sprues, vents and pins — built in seconds." },
  { n: 4, title: "Print & cast", body: "Export printable STLs, print them, and pour. Send them to a service with one click if you don't own a printer." },
];

const FAQ = [
  { q: "Is it free?", a: "Yes — the mold maker runs entirely in your browser and costs nothing. The optional AI model maker uses a small amount of AI credits." },
  { q: "Does my model leave my computer?", a: "No. All the geometry work happens in your browser. Your model is only uploaded anywhere if you sign in and save it to your own private gallery, or send it to a print service yourself." },
  { q: "Which printers and materials work?", a: "Any FDM or resin printer works for the mold halves. The built-in presets cover casting chocolate, candle wax, soap, concrete, resin and more, each with the right shrinkage and clearance." },
  { q: "What file types can I open and export?", a: "Open STL, OBJ, 3MF and STEP files. Export mold halves as STL, OBJ, 3MF or STEP." },
  { q: "I don't own a 3D printer — can I still use it?", a: "Yes. Export the mold files and send them to any of the ten print and casting services listed on our Shop page, with price estimates per mold size." },
];

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

function AccountLinks({ session }: { session: Session | null }) {
  if (!session) {
    return <Link to="/auth" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>;
  }
  return (
    <div className="flex items-center gap-3">
      <Link to="/gallery" className="text-sm">Gallery</Link>
      <button
        type="button"
        className="text-sm text-muted-foreground"
        onClick={async () => { await supabase.auth.signOut(); window.location.assign("/"); }}
      >
        Sign out ({(session.user.email ?? "account").split("@")[0]})
      </button>
    </div>
  );
}

function LandingPage() {
  const { session, ready } = useSession();
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border px-6 py-4">
        <a href="/" className="flex items-center gap-2 font-bold">
          <img src="/logo.svg" alt="Sirpam logo" width={28} height={28} className="h-7 w-7 rounded-full" />
          Sirpam <span className="text-primary">3D Labs</span> Mold
        </a>
        <div className="flex-1" />
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          <Link to="/studio">Mold Maker</Link>
          <Link to="/shop">Shop</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <div className="flex items-center gap-3">
          {ready && <AccountLinks session={session} />}
          <Link to="/studio" className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:block">
            Open the mold maker
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-10 text-center">
          <p className="mx-auto mb-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Free · runs in your browser · nothing leaves your computer
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Turn any 3D model into a <span className="text-primary">print-ready mold</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Upload an STL or OBJ and Sirpam suggests the parting plane, then builds two-part mold halves
            with sprues, vents and pins — ready to print and pour.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/studio" className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground">
              Open the mold maker
            </Link>
            <Link to="/studio" className="rounded-lg border border-border px-6 py-3 text-base font-semibold">
              Try the sample model
            </Link>
          </div>
          <img
            src={showcase}
            alt="Two halves of a 3D-printed mold with the cast part beside them"
            width={1200}
            height={640}
            className="mx-auto mt-10 w-full max-w-4xl rounded-2xl border border-border shadow-lg"
          />
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-center text-3xl font-bold">Everything a mold needs, built in</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            The details that make or break a cast — parting, venting, alignment, shrinkage — handled for you.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-2xl" aria-hidden>{f.icon}</div>
                <h3 className="mt-2 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-center text-3xl font-bold">From model to cast in four steps</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <article key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="text-center text-3xl font-bold">Questions people ask</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-2xl border border-border bg-card p-5">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-16 text-center">
          <h2 className="text-3xl font-bold">Ready to make your first mold?</h2>
          <Link to="/studio" className="mt-6 inline-block rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground">
            Open the mold maker
          </Link>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold">Sirpam 3D Labs Mold</span>
          <div className="flex-1" />
          <Link to="/studio">Mold Maker</Link>
          <Link to="/shop">Shop</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/auth">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
