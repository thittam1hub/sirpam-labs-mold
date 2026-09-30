// Google Drive for each signed-in maker: connect, save mold files, browse.
// Server functions only — provider calls and the connection key stay server-side.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appUserReconnectRequired,
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector.server";
import {
  deleteConnectionKeyForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "@/lib/driveConnections.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_drive";
const FOLDER_NAME = "Sirpam Mold Studio";
// drive.file = the app can only see and manage the files it created itself.
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const getDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const };
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: "/drive/v3/about?fields=user",
      requiredScopes: DRIVE_SCOPES,
    });
    if (await appUserReconnectRequired(res)) return { connected: false as const, reconnectRequired: true };
    if (!res.ok) return { connected: false as const, reconnectRequired: true };
    const about = (await res.json().catch(() => null)) as { user?: { emailAddress?: string; displayName?: string } } | null;
    return {
      connected: true as const,
      email: about?.user?.emailAddress ?? null,
      name: about?.user?.displayName ?? null,
    };
  });

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env['GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientAPIKey) {
      throw new Error("Google Drive is not set up yet. The Drive client key is missing.");
    }
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google_drive/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: DRIVE_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(5).max(512) }).parse(input))
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth completion returned the wrong connector");
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, connectionAPIKey);
    return { ok: true };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: key, connectorId: CONNECTOR_ID });
    }
    await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

/** Find (or create once) the app's own folder in the user's Drive. */
async function getAppFolderId(connectionAPIKey: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
  const search = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name)")}&pageSize=1`,
    requiredScopes: DRIVE_SCOPES,
  });
  if (search.ok) {
    const body = (await search.json()) as { files?: { id: string }[] };
    if (body.files?.length) return body.files[0].id;
  }
  const create = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: "/drive/v3/files?fields=id",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    },
    requiredScopes: DRIVE_SCOPES,
  });
  if (!create.ok) throw new Error(`Could not create the Drive folder (${create.status})`);
  const created = (await create.json()) as { id: string };
  return created.id;
}

export const listDriveFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const };
    let folderId: string;
    try {
      folderId = await getAppFolderId(key);
    } catch {
      return { connected: false as const, reconnectRequired: true };
    }
    const q = `'${folderId}' in parents and trashed=false`;
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: `/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name,mimeType,size,modifiedTime,webViewLink)")}&pageSize=50&orderBy=modifiedTime desc`,
      requiredScopes: DRIVE_SCOPES,
    });
    if (await appUserReconnectRequired(res)) return { connected: false as const, reconnectRequired: true };
    if (!res.ok) throw new Error(`Could not list Drive files (${res.status})`);
    const body = (await res.json()) as {
      files?: { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; webViewLink?: string }[];
    };
    return {
      connected: true as const,
      folderId,
      files: (body.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        sizeBytes: f.size ? Number(f.size) : null,
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
      })),
    };
  });

const saveInput = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.string().max(120).default("application/octet-stream"),
  dataBase64: z.string().max(30_000_000), // ~22 MB binary
});

export const saveToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) throw new Error("Connect Google Drive first.");
    const folderId = await getAppFolderId(key);

    const boundary = "sirpam-mold-upload-" + Math.random().toString(36).slice(2);
    const binary = Buffer.from(data.dataBase64, "base64");
    const metadata = JSON.stringify({ name: data.name, parents: [folderId] });
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([head, binary, tail]);

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: "/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      init: {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: new Uint8Array(body),
      },
      requiredScopes: DRIVE_SCOPES,
    });
    if (await appUserReconnectRequired(res)) throw new Error("Your Google Drive access needs to be renewed. Reconnect to continue.");
    if (!res.ok) throw new Error(`Google Drive upload failed (${res.status})`);
    return (await res.json()) as { id: string; name: string; webViewLink?: string };
  });
