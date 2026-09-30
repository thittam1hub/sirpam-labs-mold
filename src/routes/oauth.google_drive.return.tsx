import { createFileRoute } from '@tanstack/react-router'
// OAuth return landing for the Google Drive connection (popup).
// Inline parser only — never import server-only modules here.
import { useEffect, useState } from "react";

function parseReturn(searchParams: URLSearchParams) {
  const connectorId = searchParams.get("connector_id") ?? "";
  const code = searchParams.get("code") ?? "";
  const success = searchParams.get("success") === "true";
  if (success && searchParams.get("offline_access_allowed") === "false") {
    return { success: true as const, connectorId, code: null };
  }
  if (success && code) return { success: true as const, connectorId, code };
  return {
    success: false as const,
    connectorId,
    error: searchParams.get("error") ?? (success ? "Missing code" : "Connection did not complete."),
  };
}

export const Route = createFileRoute("/oauth/google_drive/return")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "Finishing Google Drive connection — Sirpam 3D Labs Mold" }],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const result = parseReturn(new URLSearchParams(window.location.search));
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_drive", code: code ?? null },
        window.location.origin,
      );
      window.close();
    };
    if (!result.success) {
      setMessage("Failed: " + result.error);
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    if (!result.code) {
      notifyOpenerAndClose("appUserConnectorOAuthComplete");
      return;
    }
    notifyOpenerAndClose("appUserConnectorOAuthComplete", result.code);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
