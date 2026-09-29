import { createFileRoute } from "@tanstack/react-router";
import { MoldMaker } from "@/components/MoldMaker";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cast/Forge — Two-part mold maker from 3D models" },
      { name: "description", content: "Upload an STL or OBJ and generate a printable two-part mold with keys and pour spout." },
      { property: "og:title", content: "Cast/Forge — Two-part mold maker" },
      { property: "og:description", content: "Turn any watertight 3D model into a printable two-part casting mold." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MoldMaker,
});
