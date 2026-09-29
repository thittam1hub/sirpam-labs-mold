import { Link } from "@tanstack/react-router";

export function BrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 font-bold" aria-label="Sirpam 3D Labs Mold home">
      <img src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" />
      {!compact && <span>Sirpam <span className="text-primary">3D Labs</span> Mold</span>}
    </Link>
  );
}