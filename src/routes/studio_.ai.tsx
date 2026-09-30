import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { StudioLoader } from "@/components/StudioLoader";

const loadPage = () => import("../moldmaker/AiMakerPage");
const AiMakerPage = lazy(loadPage);

export const Route = createFileRoute("/studio_/ai")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/studio/ai" }],
    meta: [
      { title: "AI Model Maker — Sirpam 3D Labs Mold" },
      { name: "description", content: "Describe an object or add a photo and get a clean, printable 3D model in about a minute. Refine it, download the STL, or turn it into a mold." },
      { property: "og:title", content: "AI Model Maker — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Describe an object and get a clean, printable 3D model ready for mold making." },
      { property: "og:url", content: "/studio/ai" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { prompt?: string } => {
    const p = search["prompt"];
    return typeof p === "string" && p.length <= 900 ? { prompt: p } : {};
  },
  loader: () => { if (typeof window !== "undefined") void loadPage(); },
  component: AiMaker,
});

function AiMaker() {
  const { prompt } = Route.useSearch();
  return (
    <ClientOnly fallback={<StudioLoader />}>
      <Suspense fallback={<StudioLoader />}>
        <AiMakerPage {...(prompt ? { initialPrompt: prompt } : {})} />
      </Suspense>
    </ClientOnly>
  );
}
