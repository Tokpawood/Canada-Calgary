import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Accès Google Drive côté serveur (API REST, sans SDK).
 * Portée « drive.file » : l'application ne voit que les fichiers et dossiers qu'elle a créés elle-même.
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const ROOT_FOLDER_NAME = "Projet Canada Calgary";

export class DriveError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function driveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.DRIVE_TOKEN_KEY);
}

export function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/drive/callback`;
}

// ---------- Chiffrement du jeton de rafraîchissement ----------

function key(): Buffer {
  const raw = process.env.DRIVE_TOKEN_KEY;
  if (!raw) throw new DriveError("DRIVE_TOKEN_KEY manquant.", 500);
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

function decryptToken(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ---------- OAuth ----------

export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(origin: string, code: string): Promise<{ refreshToken: string; accessToken: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new DriveError(json.error_description ?? "Échange du code Google refusé.");
  if (!json.refresh_token) throw new DriveError("Google n'a pas fourni de jeton durable. Retirez l'accès dans votre compte Google puis reconnectez.");
  return { refreshToken: json.refresh_token, accessToken: json.access_token };
}

// Jetons d'accès gardés en mémoire tant qu'ils sont valides (environ 1 h) : évite un aller-retour
// chez Google à chaque aperçu, vignette ou dépôt servi par la même instance du serveur.
const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessTokenFrom(refreshToken: string): Promise<string> {
  const cacheKey = createHash("sha256").update(refreshToken).digest("base64url");
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  }).catch(() => null);
  if (!res) throw new DriveError("Google Drive est injoignable : vérifiez la connexion internet.", 503);
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (json.error === "invalid_grant") tokenCache.delete(cacheKey);
  if (json.error === "invalid_grant") throw new DriveError("L'accès à Google Drive a été révoqué : reconnectez-le depuis Compte et sécurité.", 409);
  if (!res.ok || !json.access_token) throw new DriveError("Google Drive a refusé l'authentification.", 502);
  tokenCache.set(cacheKey, { token: json.access_token, exp: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 300) * 1000 });
  return json.access_token;
}

export async function revokeToken(refreshToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST" }).catch(() => null);
}

// ---------- Connexion stockée ----------

export interface DriveConnection {
  dossierId: string;
  refreshToken: string | null;
  accountEmail: string | null;
  rootFolderId: string | null;
  folders: Record<string, string>;
  connectedAt: string | null;
}

export async function getConnection(dossierId: string): Promise<DriveConnection | null> {
  const { data } = await createAdminClient().from("drive_connection").select("*").eq("dossier_id", dossierId).maybeSingle();
  if (!data) return null;
  let refreshToken: string | null = null;
  if (data.refresh_token_enc) {
    try {
      refreshToken = decryptToken(data.refresh_token_enc as string);
    } catch {
      refreshToken = null; // clé changée : il faudra reconnecter
    }
  }
  return {
    dossierId,
    refreshToken,
    accountEmail: (data.account_email as string | null) ?? null,
    rootFolderId: (data.root_folder_id as string | null) ?? null,
    folders: (data.folders as Record<string, string>) ?? {},
    connectedAt: (data.connected_at as string | null) ?? null,
  };
}

export async function saveConnection(dossierId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient()
    .from("drive_connection")
    .upsert({ dossier_id: dossierId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "dossier_id" });
  if (error) throw new DriveError(error.message, 500);
}

/** Connexion active + jeton d'accès frais ; erreur explicite sinon (aucun repli ailleurs). */
export async function requireDrive(dossierId: string): Promise<{ conn: DriveConnection; token: string }> {
  if (!driveConfigured()) throw new DriveError("Google Drive n'est pas configuré sur ce serveur.", 409);
  const conn = await getConnection(dossierId);
  if (!conn?.refreshToken) throw new DriveError("Google Drive n'est pas connecté : connectez-le depuis Compte et sécurité.", 409);
  return { conn, token: await accessTokenFrom(conn.refreshToken) };
}

// ---------- Appels Drive ----------

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res) throw new DriveError("Google Drive est injoignable : vérifiez la connexion internet.", 503);
  return res;
}

async function createFolder(token: string, name: string, parent?: string): Promise<string> {
  const res = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }),
  });
  const json = (await res.json()) as { id?: string };
  if (!res.ok || !json.id) throw new DriveError("Impossible de créer le dossier sur Google Drive.");
  return json.id;
}

export async function folderUsable(token: string, id: string): Promise<boolean> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}?fields=id,trashed`);
  if (!res.ok) return false;
  const json = (await res.json()) as { trashed?: boolean };
  return !json.trashed;
}

export async function ensureRootFolder(token: string, current: string | null): Promise<string> {
  if (current && (await folderUsable(token, current))) return current;
  return createFolder(token, ROOT_FOLDER_NAME);
}

/** Sous-dossier par pièce (« Passeport », « Divers »…), créé à la demande et mémorisé. */
/**
 * Sous-dossier Drive (« Passeport », « Divers », « Bulletins »…), créé à la demande et mémorisé.
 * `parentId` : dossier Drive parent pour un sous-dossier du Coffre ; sinon la racine de l'application.
 */
export async function ensureSubfolder(conn: DriveConnection, token: string, folderKey: string, name: string, parentId?: string): Promise<string> {
  // Chemin rapide : un seul contrôle. Un dossier dont le parent est à la corbeille est lui-même « trashed ».
  const cached = conn.folders[folderKey];
  if (conn.rootFolderId && cached && (await folderUsable(token, cached))) return cached;
  const root = await ensureRootFolder(token, conn.rootFolderId);
  const id = await createFolder(token, name.replace(/[\\/]/g, "-").slice(0, 120) || "Divers", parentId ?? root);
  const folders = root === conn.rootFolderId ? { ...conn.folders, [folderKey]: id } : { [folderKey]: id };
  await saveConnection(conn.dossierId, { root_folder_id: root, folders });
  conn.rootFolderId = root;
  conn.folders = folders;
  return id;
}

export async function accountEmail(token: string): Promise<string | null> {
  const res = await driveFetch(token, "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)");
  if (!res.ok) return null;
  const json = (await res.json()) as { user?: { emailAddress?: string } };
  return json.user?.emailAddress ?? null;
}

/** Envoi « resumable » (2 requêtes) : fiable jusqu'aux 20 Mo autorisés. */
export async function uploadFile(token: string, folderId: string, name: string, mime: string, body: ArrayBuffer): Promise<string> {
  const init = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(body.byteLength) },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  const location = init.headers.get("location");
  if (!init.ok || !location) throw new DriveError("Google Drive a refusé l'envoi du fichier.");
  const res = await driveFetch(token, location, { method: "PUT", headers: { "Content-Type": mime }, body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    const quota = /quota|storage/i.test(json.error?.message ?? "");
    throw new DriveError(quota ? "Espace Google Drive plein." : "L'envoi vers Google Drive a échoué.");
  }
  return json.id;
}

/**
 * Ouvre une session d'envoi « resumable » ; le navigateur envoie ensuite le fichier directement
 * à Google (en-tête Origin : Google autorise alors l'envoi depuis cette origine).
 */
export async function startUpload(token: string, folderId: string, name: string, mime: string, size: number, origin: string): Promise<string> {
  const init = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(size), Origin: origin },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  const location = init.headers.get("location");
  if (!init.ok || !location) {
    const text = await init.text().catch(() => "");
    throw new DriveError(/quota|storage/i.test(text) ? "Espace Google Drive plein." : "Google Drive a refusé l'envoi du fichier.");
  }
  return location;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  parents: string[];
  trashed: boolean;
}

export async function fileMeta(token: string, id: string): Promise<DriveFileMeta | null> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents,trashed`);
  if (!res.ok) return null;
  const j = (await res.json()) as { id: string; name: string; size?: string; mimeType: string; parents?: string[]; trashed?: boolean };
  return { id: j.id, name: j.name, size: Number(j.size ?? 0), mimeType: j.mimeType, parents: j.parents ?? [], trashed: Boolean(j.trashed) };
}

/** Premiers octets d'un fichier Drive (contrôle du type réel après un envoi direct). */
export async function readHead(token: string, id: string, n = 16): Promise<Uint8Array> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: { Range: `bytes=0-${n - 1}` } });
  if (!res.ok) throw new DriveError("Lecture du fichier envoyé impossible.");
  return new Uint8Array(await res.arrayBuffer()).slice(0, n);
}

export async function renameItem(token: string, id: string, name: string): Promise<void> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok && res.status !== 404) throw new DriveError("Renommage sur Google Drive impossible.");
}

export async function downloadFile(token: string, id: string): Promise<Response> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  if (res.status === 404) throw new DriveError("Fichier introuvable sur Google Drive (supprimé ?).", 404);
  if (!res.ok) throw new DriveError("Lecture du fichier sur Google Drive impossible.");
  return res;
}

/** Déplace un fichier vers un autre dossier Drive en le renommant (archivage d'une version remplacée). */
export async function moveFile(token: string, id: string, folderId: string, newName: string): Promise<void> {
  const meta = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}?fields=parents`);
  if (!meta.ok) throw new DriveError("Ancienne version introuvable sur Google Drive.", 404);
  const { parents = [] } = (await meta.json()) as { parents?: string[] };
  const params = new URLSearchParams({ addParents: folderId, fields: "id" });
  const remove = parents.filter((p) => p !== folderId).join(",");
  if (remove) params.set("removeParents", remove);
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) throw new DriveError("Impossible d'archiver l'ancienne version sur Google Drive.");
}

/** « passeport.pdf » → « passeport (remplacé le 14-11-2026 13h05).pdf » (heure locale du serveur). */
export function replacedName(name: string, at = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const stamp = `${parts.day}-${parts.month}-${parts.year} ${parts.hour}h${parts.minute}`;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)} (remplacé le ${stamp})${name.slice(dot)}` : `${name} (remplacé le ${stamp})`;
}

/** Mise à la corbeille Drive (récupérable 30 jours) plutôt que suppression définitive. */
export async function trashFile(token: string, id: string): Promise<void> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok && res.status !== 404) throw new DriveError("Suppression sur Google Drive impossible.");
}

export function folderLink(id: string | null): string | null {
  return id ? `https://drive.google.com/drive/folders/${id}` : null;
}
