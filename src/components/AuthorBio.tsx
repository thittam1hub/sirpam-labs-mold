import { Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/business";

/** Short "who wrote this" block for guides and the About page. */
export function AuthorBio() {
  return (
    <aside aria-label="About the author" className="mt-10 flex gap-4 rounded-2xl border border-border bg-card p-5">
      <img src="/logo.svg" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full" />
      <div>
        <p className="font-semibold">Written by the {BUSINESS.legalName} workshop team</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We print molds and cast parts every week in our own workshop in {BUSINESS.country}, and we build the
          mold maker you're reading about. Everything here comes from what works on real prints.{" "}
          <Link to="/about" className="text-primary">More about us</Link>
        </p>
      </div>
    </aside>
  );
}
