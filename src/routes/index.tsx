import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// The mold generator uses WebGL, Web Workers, and WASM — browser-only APIs.
// Lazy-load the whole app behind ClientOnly so SSR never evaluates it.
const MoldMakerApp = lazy(() => import("../moldmaker/App"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sirpam 3D Labs Mold — two-part & silicone mold generator" },
      {
        name: "description",
        content:
          "Load an STL or OBJ, pick a parting plane, export print-ready mold halves with auto-generated sprues, vents, and registration pins. Runs in your browser — no signup, no cloud upload.",
      },
      { property: "og:title", content: "Sirpam 3D Labs Mold — two-part & silicone mold generator" },
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
  component: Index,
});

function Index() {
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
          <MoldMakerApp />
        </div>
      </Suspense>
    </ClientOnly>
  );
}
