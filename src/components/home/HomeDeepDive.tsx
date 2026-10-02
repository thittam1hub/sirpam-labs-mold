import { Link } from "@tanstack/react-router";
import { Cpu, Lock, ShieldCheck } from "lucide-react";

const ANATOMY = [
  { n: "A", t: "Pour cup and sprue", b: "A funnel-shaped opening at the highest point of the cavity. Material enters here, so it is placed where the part can tolerate a small trimmed stub." },
  { n: "B", t: "Air vents", b: "Thin channels that rise from the high spots of the cavity. Air escapes through them instead of becoming a bubble in your cast." },
  { n: "C", t: "Alignment keys", b: "Matching bumps and sockets on the parting face. They stop the halves from sliding, so the seam lines up and the cast has no step." },
  { n: "D", t: "Parting face and flange", b: "The flat or shaped surface where the halves meet. An optional flange widens it, giving clamps and rubber bands more to grip." },
  { n: "E", t: "Clamp wings and seats", b: "Tabs with bolt holes around the outside. Raised seats keep pressure on the seam so thin material does not leak out." },
  { n: "F", t: "Core pin", b: "A separate printed pin through both halves for hollow parts, candle wicks or hanging holes. You insert it before pouring." },
];

const SPLITS = [
  { t: "Widest-outline search", b: "The studio tests the model along every axis and keeps the split with the fewest stuck spots. For most shapes this is the right answer on the first try." },
  { t: "Angled split", b: "Tilts the parting plane for parts that lean, such as a figurine mid-stride. The seam follows the shape instead of cutting across a face." },
  { t: "Curved split", b: "Bends the parting surface around raised details so neither half grips them. Useful for reliefs, badges and organic shapes." },
  { t: "3 and 4 part molds", b: "Cuts the mold into wedges around the part. Use this when a shape is wider in the middle than at either end and two halves would lock." },
];

const MATERIALS = [
  { m: "Platinum silicone", use: "Food-safe molds, skin-safe parts, long mold life", shore: "Usually 10A to 40A", note: "Cure is stopped by sulphur clays, latex gloves and some 3D print resins. Seal prints first." },
  { m: "Tin silicone", use: "Low-cost molds for resin, plaster and concrete", shore: "Usually 10A to 40A", note: "More forgiving to cure, but shrinks slightly more and wears out sooner." },
  { m: "PU resin", use: "Fast, hard parts and small batches", shore: "Rigid, often D-scale", note: "Short working time, especially in warm workshops. Keep away from moisture." },
  { m: "Epoxy", use: "Clear castings, inlays and jewellery", shore: "Rigid", note: "Slow setting. Thick pours can heat up, so follow the maximum pour depth on the label." },
  { m: "Plaster", use: "Decor, prototypes and moulds for slip", shore: "Rigid, brittle", note: "Mix by weight. Releases heat while setting; avoid it in thin printed molds without release." },
  { m: "Candle wax and soap", use: "Pillar candles, soap bars", shore: "Soft", note: "Pour at the temperature on the product label. A core pin leaves a clean wick hole." },
];

const PRINT = [
  { k: "Walls", v: "3 to 4 perimeters, so the cavity surface stays smooth and does not leak." },
  { k: "Layer height", v: "0.12 to 0.2 mm on FDM. Finer layers mean fewer lines on your cast." },
  { k: "Infill", v: "20 to 30 percent. The mold resists pouring pressure without wasting filament." },
  { k: "Orientation", v: "Parting face down on the bed, so the face that meets the other half is flat." },
  { k: "Material", v: "PLA or PETG for most casting. Avoid PLA near hot wax and resins that heat up." },
  { k: "Release", v: "Seal and release the cavity. Silicone sticks to silicone without a barrier." },
];

const USES = [
  { t: "Resin prototypes and figurines", b: "Copy a printed master into a few dozen resin parts with no layer lines, for product tests, tabletop pieces and spares." },
  { t: "Plaster and concrete decor", b: "Planters, coasters and wall tiles from a printed rigid mold, with draft added so the cast comes out cleanly." },
  { t: "Candles", b: "Pillar and shaped candles with a centred core pin that leaves a straight channel for the wick." },
  { t: "Soap", b: "Melt-and-pour bars and shaped soaps. Material presets set clearance so bars release without tearing." },
  { t: "Silicone tooling", b: "Print a mold box that hugs your master, pour silicone, and get a flexible mold for repeat casting." },
  { t: "Engineering parts", b: "Gaskets, grips and rubber-like parts cast in silicone or PU from a STEP file you keep editing in CAD." },
];

export function HomeDeepDive() {
  return (
    <>
      {/* Anatomy */}
      <section className="border-y border-border bg-card" aria-labelledby="anatomy-h">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Mold anatomy</p>
          <h2 id="anatomy-h" className="mt-2 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">Every feature a working mold needs, placed for you.</h2>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-muted-foreground">
            A printed mold fails for small reasons: a bubble at the top, a half that slides, a seam that leaks. These are the parts the studio adds to each mold, and what each one does.
          </p>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {ANATOMY.map((a) => (
              <li key={a.n} className="bg-background p-6">
                <span className="font-mono text-sm font-semibold text-primary">{a.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{a.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Parting */}
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-[1fr_1.4fr]" aria-labelledby="split-h">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Parting engine</p>
          <h2 id="split-h" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Where you split decides whether the cast comes out.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            A part with an overhang will lock a two-part mold shut. The studio previews the seam in 3D and shows stuck areas in red before anything is printed, so you choose the split with evidence instead of guesswork.
          </p>
        </div>
        <dl className="grid gap-6 sm:grid-cols-2">
          {SPLITS.map((s) => (
            <div key={s.t} className="border-l-2 border-primary pl-4">
              <dt className="font-semibold">{s.t}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.b}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Privacy and on-device */}
      <section className="mx-auto max-w-7xl px-6 pb-20" aria-labelledby="private-h">
        <div className="grid gap-8 rounded-xl border border-border bg-muted p-8 md:grid-cols-3 md:p-10">
          <div className="md:col-span-3">
            <h2 id="private-h" className="text-2xl font-bold tracking-tight md:text-3xl">Your designs stay on your computer.</h2>
            <p className="mt-2 max-w-[70ch] text-muted-foreground">Client parts and unreleased products are sensitive. The mold engine runs inside your browser, so files are not uploaded to build a mold.</p>
          </div>
          {[
            { I: Lock, t: "Built in your browser", b: "Splitting, cutting the cavity and adding keys all happen on your machine. Nothing is sent to us unless you save or share it." },
            { I: Cpu, t: "Free checks on your device", b: "Mold Doctor reads the engine's own measurements to explain air traps and tearing risk, without using credits." },
            { I: ShieldCheck, t: "Exact geometry, not guesses", b: "AI only explains and suggests settings. Every mold is built by the geometry engine, so halves close properly." },
          ].map(({ I, t, b }) => (
            <div key={t}>
              <I size={22} className="text-primary" aria-hidden />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Materials table */}
      <section className="border-y border-border bg-card" aria-labelledby="mat-h">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Casting materials</p>
          <h2 id="mat-h" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Choose the material, then the mold.</h2>
          <p className="mt-4 max-w-[65ch] text-muted-foreground">General guidance for common materials. Brands differ, so always follow the technical data sheet for the exact product you buy.</p>
          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-4">Material</th><th className="p-4">Best for</th><th className="p-4">Hardness</th><th className="p-4">Watch out for</th></tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {MATERIALS.map((r) => (
                  <tr key={r.m}>
                    <th scope="row" className="p-4 font-semibold">{r.m}</th>
                    <td className="p-4 text-muted-foreground">{r.use}</td>
                    <td className="p-4 font-mono text-xs">{r.shore}</td>
                    <td className="p-4 text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Print settings */}
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-[1fr_1.4fr]" aria-labelledby="print-h">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Printing the mold</p>
          <h2 id="print-h" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Slicer settings that give a clean cast.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">Good starting points for FDM printers. Resin printers give smoother cavities; check that your resin does not stop platinum silicone from curing.</p>
          <Link to="/guides" className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline">Read the step-by-step guides</Link>
        </div>
        <dl className="divide-y divide-border border-y border-border">
          {PRINT.map((p) => (
            <div key={p.k} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]">
              <dt className="font-mono text-sm font-semibold">{p.k}</dt>
              <dd className="text-sm text-muted-foreground">{p.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Uses */}
      <section className="mx-auto max-w-7xl px-6 pb-20" aria-labelledby="use-h">
        <h2 id="use-h" className="text-3xl font-bold tracking-tight md:text-4xl">What people cast with it</h2>
        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {USES.map((u) => (
            <article key={u.t} className="border-t border-border pt-5">
              <h3 className="font-semibold">{u.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{u.b}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
