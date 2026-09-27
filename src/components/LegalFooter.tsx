import { Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/business";

export function LegalFooter() {
  return (
    <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
      <p>
        {BUSINESS.product} is operated by <b>{BUSINESS.legalName}</b>, {BUSINESS.country}. Contact:{" "}
        <a className="text-primary" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
      </p>
      <p className="mt-2">
        <Link to="/terms">Terms</Link> · <Link to="/refunds">Refund policy</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/pricing">Pricing</Link>
      </p>
    </footer>
  );
}
