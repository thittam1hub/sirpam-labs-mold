import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function loadGoogleAnalytics(measurementId: string) {
  if (document.getElementById("ga4-src")) return;

  const script = document.createElement("script");
  script.id = "ga4-src";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag.js reads `arguments` objects from dataLayer, not plain arrays.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // Route changes are sent manually below, so the tag does not double-count.
  window.gtag("config", measurementId, { send_page_view: false });
}

function loadClarity(projectId: string) {
  if (document.getElementById("clarity-src")) return;

  window.clarity =
    window.clarity ||
    function clarity(...args: unknown[]) {
      (window.clarity as unknown as { q?: unknown[] }).q =
        (window.clarity as unknown as { q?: unknown[] }).q || [];
      (window.clarity as unknown as { q: unknown[] }).q.push(args);
    };

  const script = document.createElement("script");
  script.id = "clarity-src";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
  document.head.appendChild(script);
}

/**
 * Loads Google Analytics 4 and Microsoft Clarity in the browser only, and
 * reports one page view per client-side route change.
 */
export function Analytics({
  gaId,
  clarityId,
}: {
  gaId?: string;
  clarityId?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (gaId) loadGoogleAnalytics(gaId);
    if (clarityId) loadClarity(clarityId);
  }, [gaId, clarityId]);

  useEffect(() => {
    if (!gaId || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: `${pathname}${search ?? ""}`,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [gaId, pathname, search]);

  return null;
}
