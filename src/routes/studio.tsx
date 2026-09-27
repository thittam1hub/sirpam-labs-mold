import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// The mold generator uses WebGL, Web Workers, and WASM — browser-only APIs.
// Lazy-load the whole app behind ClientOnly so SSR never evaluates it.
const MoldMakerApp = lazy(() => import("../moldmaker/App"));

const studioTools = {
  "sirpam-model-tools": 1,
  "sirpam-ai-shape": 1,
  "sirpam-shop-prep": 3,
  "sirpam-finish-advisor": 5,
  "sirpam-plate-packer": 5,
  "sirpam-projects": 5,
} as const;
type StudioTool = keyof typeof studioTools;

export const Route = createFileRoute("/studio")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Mold Maker Studio — Sirpam 3D Labs Mold" },
      {
        name: "description",
        content:
          "Load an STL or OBJ, pick a parting plane, export print-ready mold halves with auto-generated sprues, vents, and registration pins. Runs in your browser — no signup, no cloud upload.",
      },
      { property: "og:title", content: "Mold Maker Studio — Sirpam 3D Labs Mold" },
      {
        property: "og:description",
        content:
          "Turn 3D models into print-ready mold halves with auto-generated sprues, vents, and registration pins. Runs in your browser, offline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
  }),
  validateSearch: (search: Record<string, unknown>): { step?: number; tool?: StudioTool } => {
    const step = Number(search["step"]);
    const result: { step?: number; tool?: StudioTool } = {};
    if (Number.isInteger(step) && step >= 1 && step <= 5) result.step = step;
    const tool = search["tool"];
    if (typeof tool === "string" && tool in studioTools) {
      result.tool = tool as StudioTool;
      if (!result.step) result.step = studioTools[result.tool];
    }
    return result;
  },
  component: Studio,
});

function Studio() {
  const search = Route.useSearch();
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          Loading Mold Maker…
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
            Loading Mold Maker…
          </div>
        }
      >
        <div className="fixed inset-0">
          <MoldMakerApp {...(search.step ? { initialStep: search.step } : {})} {...(search.tool ? { initialTool: search.tool } : {})} />
        </div>
      </Suspense>
    </ClientOnly>
  );
}
