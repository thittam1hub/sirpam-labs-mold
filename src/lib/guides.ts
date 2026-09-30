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
];

export const getGuide = (slug: string) => GUIDES.find(g => g.slug === slug);
