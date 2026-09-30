// "Save to Google Drive" card: connect your own Drive, save mold files, browse them.
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  completeDriveConnect,
  disconnectDrive,
  getDriveStatus,
  listDriveFiles,
  saveToDrive,
  startDriveConnect,
} from "@/lib/drive.functions";
import { Skeleton } from "@/components/ui/skeleton";

const CONNECTOR_ID = "google_drive";

function waitForOAuthCompletion(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("Google Drive connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Connection window was closed before finishing."));
    }, 500);
  });
}

function fmtSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DriveCard() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getDriveStatus);
  const listFn = useServerFn(listDriveFiles);
  const startFn = useServerFn(startDriveConnect);
  const completeFn = useServerFn(completeDriveConnect);
  const saveFn = useServerFn(saveToDrive);
  const disconnectFn = useServerFn(disconnectDrive);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const status = useQuery({ queryKey: ["drive-status"], queryFn: statusFn });
  const connected = status.data?.connected === true;

  const files = useQuery({
    queryKey: ["drive-files"],
    queryFn: listFn,
    enabled: connected,
    retry: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["drive-status"] });
    void queryClient.invalidateQueries({ queryKey: ["drive-files"] });
  }, [queryClient]);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(null), 6000);
    return () => clearTimeout(t);
  }, [justSaved]);

  const connect = async () => {
    setErr(null); setBusy(true);
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) { setErr("Allow popups to connect Google Drive."); setBusy(false); return; }
    let code: string | null;
    try {
      const { authorizationUrl } = await startFn();
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = authorizationUrl;
      code = await completion;
    } catch (x) {
      popup.close();
      setErr(x instanceof Error ? x.message : "Connection failed");
      setBusy(false);
      return;
    }
    try {
      if (code) await completeFn({ data: { code } });
      refresh();
      setJustSaved("Google Drive connected.");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not finish connecting");
    }
    setBusy(false);
  };

  const disconnect = async () => {
    setErr(null); setBusy(true);
    try {
      await disconnectFn();
      refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not disconnect");
    }
    setBusy(false);
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setErr(null); setBusy(true);
    try {
      for (const f of Array.from(list)) {
        if (f.size > 22 * 1024 * 1024) throw new Error(`${f.name} is larger than 22 MB.`);
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        const chunk = 0x8000;
        for (let i = 0; i < buf.length; i += chunk) {
          bin += String.fromCharCode(...buf.subarray(i, i + chunk));
        }
        const saved = await saveFn({ data: { name: f.name, mimeType: f.type || "application/octet-stream", dataBase64: btoa(bin) } });
        setJustSaved(`Saved "${saved.name}" to Drive.`);
      }
      await files.refetch();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Upload failed");
    }
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5" aria-labelledby="drive-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="drive-heading" className="text-lg font-semibold">Google Drive</h2>
          <p className="text-sm text-muted-foreground">
            Connect your own Google Drive to save and browse your mold files in one place. The app can only see the files it saves for you.
          </p>
        </div>
        {status.isLoading ? (
          <Skeleton className="h-9 w-32" />
        ) : connected ? (
          <button disabled={busy} onClick={() => void disconnect()} className="rounded-lg border border-input px-3 py-1.5 text-sm disabled:opacity-60">
            Disconnect
          </button>
        ) : (
          <button disabled={busy} onClick={() => void connect()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {status.data?.reconnectRequired ? "Reconnect Google Drive" : busy ? "Connecting…" : "Connect Google Drive"}
          </button>
        )}
      </div>

      {connected && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input
              ref={fileInput}
              type="file"
              multiple
              aria-label="Choose files to save to Drive"
              onChange={(e) => void upload(e.target.files)}
              className="text-sm"
              disabled={busy}
            />
            {busy && <span className="text-muted-foreground">Working…</span>}
          </div>
          {justSaved && <p className="mt-2 text-sm text-primary">{justSaved}</p>}
          {files.isLoading ? (
            <div className="mt-3 space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : files.data && files.data.connected && files.data.files.length > 0 ? (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
              {files.data.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">
                    {f.webViewLink ? (
                      <a href={f.webViewLink} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{f.name}</a>
                    ) : f.name}
                    <span className="ml-2 text-xs text-muted-foreground">{fmtSize(f.sizeBytes)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : files.data && files.data.connected ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing saved yet — choose a file above to save it to your Drive.</p>
          ) : files.data?.reconnectRequired ? (
            <p className="mt-3 text-sm text-destructive">Your Google Drive access needs to be renewed. Click Reconnect above.</p>
          ) : null}
        </div>
      )}
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </section>
  );
}
