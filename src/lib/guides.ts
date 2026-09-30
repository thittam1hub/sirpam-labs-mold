export type GuideSection = { h: string; p: string[]; steps?: string[] };
export type Guide = {
  slug: string;
  title: string;
  description: string;
  minutes: number;
  /** ISO 8601 date the guide was first published. */
  published: string;
  /** ISO 8601 date of the last meaningful edit. */
  updated: string;
  /** Absolute URL of the cover image used for search rich results. */
  image: string;
  sections: GuideSection[];
};

/** Shared cover photo (1200x675) served from /public. */
export const GUIDE_IMAGE = "https://mold.sirpam3dlabs.in/guide-cover.jpg";

export const GUIDES: Guide[] = [
  {
    slug: "how-to-make-silicone-molds",
    title: "How to make silicone molds at home",
    description: "A step-by-step beginner guide to making silicone molds: choosing silicone, building a mold box, mixing, degassing, pouring and demolding.",
    minutes: 7,
    published: "2026-09-27",
    updated: "2026-09-30",
    image: GUIDE_IMAGE,
    sections: [
      { h: "What you need", p: ["A master (the object you want to copy), platinum-cure or tin-cure silicone, a mold box, mold release, mixing cups, a scale, and a stir stick. Platinum silicone is best for food, resin and long life; tin-cure is cheaper and more forgiving."] },
      { h: "Step by step", p: [], steps: [
        "Clean the master and fix it to the base of the mold box so it can't float.",
        "Leave at least 10 mm of space between the master and every wall of the box.",
        "Spray a thin coat of mold release on the box (and the master, if it is porous).",
        "Weigh part A and part B exactly by the ratio on the label — most silicones fail from guessed ratios.",
        "Mix slowly for 2–3 minutes, scraping the sides and bottom.",
        "Degas in a vacuum chamber if you have one, or pour from high up in a thin stream to break bubbles.",
        "Pour into the lowest corner and let the silicone rise over the master.",
        "Wait the full cure time on the label (often 4–24 hours), then demold.",
      ] },
      { h: "One-part vs two-part silicone molds", p: ["A one-part (open) mold works when the object has a flat back. Anything round or with undercuts needs a two-part mold: pour the first half, add keys, apply release, then pour the second half so the halves line up."] },
      { h: "Skip the mold box", p: ["Sirpam 3D Labs Mold builds a printable pour box, two-part block or skin + mother mold around your 3D model, with keys, pour hole and vents already placed. Print it, pour silicone, done."] },
    ],
  },
  {
    slug: "3d-printed-molds",
    title: "3D printed molds: a practical guide",
    description: "How to design and print rigid two-part molds on FDM or resin printers — parting lines, locks, vents, wall thickness, fit gap and release.",
    minutes: 6,
    published: "2026-09-27",
    updated: "2026-09-30",
    image: GUIDE_IMAGE,
    sections: [
      { h: "When a printed mold makes sense", p: ["Printed rigid molds are great for wax, soap, plaster, concrete, chocolate (with food-safe coating) and short resin runs. For many casts, or for very detailed parts, print a master and make a silicone mold instead."] },
      { h: "Design rules that work", p: [], steps: [
        "Split along the widest part of the model so both halves release (the parting line).",
        "Walls of 2.4–4 mm on FDM, 1.5–3 mm on resin.",
        "Use 3–6 cone or round locks so the halves line up.",
        "Leave a fit gap of about 0.2 mm on FDM and 0.1 mm on resin.",
        "Put the pour hole at the highest point and add vents where air gets trapped.",
        "Add a flat flange with bolt holes if you need to clamp the mold shut.",
      ] },
      { h: "Printing and finishing", p: ["Print the parting face flat on the bed for a tight seal. Sand the cavity lightly, seal it (epoxy or XTC-3D) for a smooth cast, and always use mold release."] },
      { h: "Let the app do the geometry", p: ["Sirpam 3D Labs Mold finds the best split, places locks, pour hole and vents, and exports both halves as print-ready STL files."] },
    ],
  },
  {
    slug: "stl-to-mold",
    title: "How to turn an STL into a mold",
    description: "Convert any STL or OBJ file into a printable two-part mold in your browser: load, repair, split, choose a mold type and export.",
    minutes: 4,
    published: "2026-09-28",
    updated: "2026-09-30",
    image: GUIDE_IMAGE,
    sections: [
      { h: "The quick version", p: [], steps: [
        "Open the Studio and drop in your STL or OBJ file.",
        "If the model has holes or broken faces, press Repair broken model.",
        "In Split, press Suggest Best Split to find the cleanest parting line.",
        "In Mold, choose rigid (printed) or silicone, and set locks, walls and vents.",
        "Press Generate Mold and check the preview.",
        "Export both halves as STL, 3MF or STEP and print them.",
      ] },
      { h: "Common problems", p: ["Very detailed files (millions of triangles) are slow — use Reduce detail first. Files that aren't a closed solid are repaired automatically, and the app tells you what it fixed."] },
    ],
  },
  {
    slug: "silicone-shore-hardness-and-cure-inhibition",
    title: "Silicone shore hardness and cure inhibition with 3D printed masters",
    description: "Which silicone hardness (10A, 20A, 30A, 40A) to pick for your mold, and how to stop platinum silicone staying sticky on resin or PLA prints.",
    minutes: 6,
    published: "2026-09-30",
    updated: "2026-09-30",
    image: GUIDE_IMAGE,
    sections: [
      { h: "What shore hardness means", p: ["Shore A is a number for how soft or firm cured silicone is. Lower numbers bend more; higher numbers hold shape better. The number on the label is the most useful thing to check when buying silicone."] },
      { h: "Which hardness to choose", p: [], steps: [
        "10A–15A: very soft and stretchy. Good for deep undercuts and fragile details that must peel out, like jewellery, figurines with thin parts and textured surfaces.",
        "20A–25A: the all-rounder. Good for resin art, candles, soap and most hobby molds. Pick this if you are unsure.",
        "30A–40A: firm. Holds shape for larger parts, plaster, concrete and tiles, and wears more slowly over many casts.",
        "Thin skin molds (brushed on in layers) need a rigid mother mold behind them whatever the hardness.",
      ] },
      { h: "Why platinum silicone stays sticky on prints", p: ["Platinum-cure silicone can fail to cure where it touches some materials. This is called cure inhibition. Common causes are uncured resin on SLA/DLP prints, sulphur-based clays, latex gloves, and some paints and primers. The silicone next to the master stays tacky while the rest cures."] },
      { h: "How to prevent it", p: [], steps: [
        "Wash resin prints well in IPA, then post-cure fully under UV. Many makers bake the print lightly (around 60 °C for an hour) to be safe.",
        "Seal the master with a clear acrylic spray or shellac and let it dry completely.",
        "Wear nitrile gloves, not latex.",
        "Do a small test: pour a spoonful of silicone on a spare print or the base of the master and check it cures.",
        "If you can't avoid inhibition, switch to tin-cure silicone. It is far less sensitive, but molds shrink a little more and last less long.",
      ] },
      { h: "PLA and PETG masters", p: ["FDM prints rarely inhibit platinum silicone, but layer lines copy straight into the mold. Sand, fill with primer, and seal before pouring for a smooth cast."] },
      { h: "Plan the mold in the Studio", p: ["Sirpam 3D Labs Mold builds a pour box, two-part block or skin + mother mold around your model and estimates how much silicone you need, so you buy the right amount of the right hardness."] },
    ],
  },
  {
    slug: "bubble-free-silicone-molds-without-vacuum",
    title: "Bubble-free silicone molds without a vacuum chamber",
    description: "Practical ways to get bubble-free silicone and resin casts at home without a vacuum pump: mixing, high thin pours, brushing a first coat, vibration and venting.",
    minutes: 5,
    published: "2026-09-30",
    updated: "2026-09-30",
    image: GUIDE_IMAGE,
    sections: [
      { h: "Where bubbles come from", p: ["Most bubbles are whipped in while mixing, or trapped under overhangs and in small details as the silicone flows. A vacuum chamber pulls them out, but a few simple habits get you very close without one."] },
      { h: "Mix without whipping air in", p: [], steps: [
        "Choose a slow-curing silicone with a long pot life, so bubbles have time to rise.",
        "Warm both parts to room temperature (around 25 °C) — thinner silicone releases air faster.",
        "Stir slowly with a flat stick, scraping the sides and bottom. Don't beat or whisk.",
        "Pour the mix into a second clean cup and stir again, so no unmixed silicone from the walls ends up in the mold.",
      ] },
      { h: "Pour the right way", p: [], steps: [
        "Brush or dab a thin first coat onto the master to fill small details, and pop bubbles with the brush.",
        "Pour from 30–50 cm high in a thread-thin stream. The stream stretches and bursts bubbles before they land.",
        "Pour into the lowest corner of the box, never straight onto the master, and let the silicone rise over it.",
        "Tap the box on the table or rest it on a phone or massager set to vibrate for a few minutes.",
        "Pass a heat gun or lighter quickly over the surface to pop any bubbles that come up.",
      ] },
      { h: "Let air escape from the mold", p: ["When you cast into the finished mold, trapped air in high points is the biggest cause of holes in the part. Add vents at every high point and put the pour hole at the top."] },
      { h: "Automatic vents in the Studio", p: ["Sirpam 3D Labs Mold shows where air will get trapped in your mold and places vents there for you, alongside the pour hole and locks."] },
    ],
  },
];

export const getGuide = (slug: string) => GUIDES.find(g => g.slug === slug);
