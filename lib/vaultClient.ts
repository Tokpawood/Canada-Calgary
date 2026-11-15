import { validateVaultFile } from "@/lib/fileSniff";
import type { VaultFile } from "@/lib/types";
import type { VaultFolder } from "@/lib/folders";

/** Adresse de lecture d'un fichier : servie par l'application (Google Drive ou ancien stockage Supabase). */
export function fileUrl(f: VaultFile, download = false): string {
  return `/api/files/${f.id}${download ? "?download=1" : ""}`;
}

export async function signFileUrl(f: VaultFile, download = false): Promise<string | null> {
  return fileUrl(f, download);
}

export interface UploadResult {
  file?: VaultFile;
  replaced?: VaultFile | null;
  error?: string;
}

export interface UploadOptions {
  documentId?: string | null;
  folderId?: string | null;
  /** Avancement de 0 à 1. */
  onProgress?: (p: number) => void;
}

/** Au-delà, une photo est réduite avant l'envoi (scan lisible, envoi bien plus rapide). */
const COMPRESS_ABOVE = 2.5 * 1024 * 1024;
const MAX_SIDE = 2800;
/** Taille de requête acceptée par le serveur pour l'envoi relais (de secours). */
const RELAY_LIMIT = 4 * 1024 * 1024;

/** Réduit une grande photo JPEG/PNG (appareil photo) en JPEG ; renvoie le fichier d'origine sinon. */
export async function shrinkImage(file: File, mime: string): Promise<File> {
  if ((mime !== "image/jpeg" && mime !== "image/png") || file.size <= COMPRESS_ABOVE || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // fond blanc pour les PNG transparents
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.(png|jpe?g)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; json: T & { error?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false, json: { error: "Serveur injoignable." } as T & { error?: string } };
  return { ok: res.ok, json: (await res.json().catch(() => ({}))) as T & { error?: string } };
}

/** Envoi du fichier directement à Google Drive (adresse de session ouverte par le serveur). */
function putToDrive(url: string, file: Blob, mime: string, onProgress?: (p: number) => void): Promise<{ id?: string; status: number }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let id: string | undefined;
      try {
        id = (JSON.parse(xhr.responseText) as { id?: string }).id;
      } catch {
        id = undefined;
      }
      resolve({ id, status: xhr.status });
    };
    xhr.onerror = () => resolve({ status: 0 });
    xhr.send(file);
  });
}

async function relayUpload(file: File, opts: UploadOptions): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  if (opts.documentId) body.append("documentId", opts.documentId);
  if (opts.folderId) body.append("folderId", opts.folderId);
  const res = await fetch("/api/files", { method: "POST", body }).catch(() => null);
  if (!res) return { error: "Serveur injoignable." };
  const json = (await res.json().catch(() => ({}))) as UploadResult;
  if (!res.ok || !json.file) return { error: json.error ?? "Envoi refusé." };
  opts.onProgress?.(1);
  return { file: json.file, replaced: json.replaced ?? null };
}

/** Dépose un fichier sur Google Drive : envoi direct depuis le navigateur, relais par le serveur en secours. */
export async function uploadVaultFile(original: File, opts: UploadOptions = {}): Promise<UploadResult> {
  // Contrôle immédiat côté navigateur ; le serveur refait le contrôle sur le fichier arrivé.
  const first = await validateVaultFile(original);
  if (!first.ok || !first.mime) return { error: first.reason ?? "Fichier refusé." };
  const file = await shrinkImage(original, first.mime);
  const mime = file === original ? first.mime : "image/jpeg";
  opts.onProgress?.(0.02);

  const target = { documentId: opts.documentId ?? null, folderId: opts.folderId ?? null };
  const session = await postJson<{ uploadUrl?: string }>("/api/files/session", { name: file.name, size: file.size, mime, ...target });
  if (!session.ok || !session.json.uploadUrl) {
    // Erreur métier (Drive non connecté, quota…) : inutile de réessayer autrement.
    return { error: session.json.error ?? "Envoi refusé." };
  }

  const put = await putToDrive(session.json.uploadUrl, file, mime, (p) => opts.onProgress?.(0.02 + p * 0.9));
  if (!put.id) {
    // Envoi direct bloqué (réseau, navigateur) : on passe par le serveur si la taille le permet.
    if (file.size <= RELAY_LIMIT) return relayUpload(file, opts);
    return { error: put.status === 0 ? "Connexion interrompue pendant l'envoi : réessayez." : "Google Drive a refusé l'envoi du fichier." };
  }

  const commit = await postJson<UploadResult>("/api/files/commit", { driveFileId: put.id, ...target });
  if (!commit.ok || !commit.json.file) return { error: commit.json.error ?? "Enregistrement refusé." };
  opts.onProgress?.(1);
  return { file: commit.json.file, replaced: commit.json.replaced ?? null };
}

/** Envoie plusieurs fichiers en parallèle (3 à la fois) ; `onDone` est appelé pour chacun dès qu'il est fini. */
export async function uploadMany(
  files: File[],
  opts: Omit<UploadOptions, "onProgress">,
  onDone: (file: File, res: UploadResult) => void,
  onProgress?: (file: File, p: number) => void,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const res = await uploadVaultFile(f, { ...opts, onProgress: (p) => onProgress?.(f, p) });
      onDone(f, res);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
}

export async function deleteVaultFile(id: string): Promise<string | null> {
  const res = await fetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res) return "Serveur injoignable.";
  if (res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error ?? "Suppression refusée.";
}

export async function moveVaultFile(id: string, folderId: string | null): Promise<UploadResult> {
  const res = await fetch(`/api/files/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ folderId }) }).catch(() => null);
  if (!res) return { error: "Serveur injoignable." };
  const json = (await res.json().catch(() => ({}))) as UploadResult;
  return res.ok && json.file ? { file: json.file } : { error: json.error ?? "Classement refusé." };
}

export async function createFolder(name: string): Promise<{ folder?: VaultFolder; error?: string }> {
  const { ok, json } = await postJson<{ folder?: VaultFolder }>("/api/folders", { name });
  return ok && json.folder ? { folder: json.folder } : { error: json.error ?? "Création impossible." };
}

export async function renameFolder(id: string, name: string): Promise<{ folder?: VaultFolder; error?: string }> {
  const res = await fetch(`/api/folders/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
  if (!res) return { error: "Serveur injoignable." };
  const json = (await res.json().catch(() => ({}))) as { folder?: VaultFolder; error?: string };
  return res.ok && json.folder ? { folder: json.folder } : { error: json.error ?? "Renommage impossible." };
}

export async function deleteFolder(id: string): Promise<string | null> {
  const res = await fetch(`/api/folders/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res) return "Serveur injoignable.";
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Suppression impossible.";
}
