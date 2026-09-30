import { ThemeToggle } from "@/components/ThemeToggle";
import { ReportIssue } from "@/components/ReportIssue";
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { BrandLink } from "@/components/BrandLink";
import { useAppSession } from "@/components/AppSession";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const links = [
  { to: "/studio", label: "Studio" },
  { to: "/shop", label: "Shop" },
  { to: "/gallery", label: "Gallery" },
  { to: "/pricing", label: "Pricing" },
  { to: "/help", label: "Help" },
] as const;

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { session, ready, signOut } = useAppSession();
  const location = useLocation();
  const redirect = `${location.pathname}${location.searchStr || ""}`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/100 shadow-sm">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <BrandLink compact={compact} />
        <nav aria-label="Primary navigation" className="ml-auto hidden items-center gap-1 lg:flex">
          {links.map((item) => (
            <Link key={item.to} to={item.to} preload="intent" activeProps={{ className: "bg-accent text-accent-foreground" }} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <ReportIssue triggerClassName="hidden sm:inline-flex" />
        <ThemeToggle />
        <div className="hidden min-h-9 min-w-28 items-center justify-end gap-2 sm:flex">
          {!ready ? <Skeleton className="h-9 w-28" /> : session ? (
            <>
              <Button asChild variant="outline" size="sm"><Link to="/account" search={{ tab: "profile" }}>Account</Link></Button>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : (
            <Button asChild size="sm"><Link to="/auth" search={{ redirect }}>Sign in</Link></Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="ml-auto lg:hidden" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav aria-label="Mobile navigation" className="border-t border-border px-4 py-3 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {links.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium">{item.label}</Link>)}
            <ReportIssue triggerClassName="justify-start" />
            {!ready ? <Skeleton className="h-10 w-full" /> : session ? (
              <>
                <Link to="/account" search={{ tab: "profile" }} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium">Account</Link>
                <Button variant="ghost" className="justify-start" onClick={() => void signOut()}>Sign out</Button>
              </>
            ) : <Link to="/auth" search={{ redirect }} onClick={() => setOpen(false)} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>}
          </div>
        </nav>
      )}
    </header>
  );
}