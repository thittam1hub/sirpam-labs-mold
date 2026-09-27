import { Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/business";
import { BrandLink } from "@/components/BrandLink";

export function LegalFooter() {
  return (
    <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
      <div className="mb-4 text-foreground"><BrandLink /></div>
      <p>
        {BUSINESS.product} is operated by <b>{BUSINESS.legalName}</b>, {BUSINESS.country}. Contact:{" "}
        <a className="text-primary" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
      </p>
      <p className="mt-2">
        <Link to="/about">About</Link> · <Link to="/help">Help</Link> · <Link to="/contact">Contact</Link> · <Link to="/pricing">Pricing</Link>
      </p>
      <p className="mt-1">
        <Link to="/terms">Terms</Link> · <Link to="/refunds">Refund policy</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/licenses">Licenses</Link>
      </p>
    </footer>
  );
}
