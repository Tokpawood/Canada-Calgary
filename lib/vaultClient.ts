import { validateVaultFile } from "@/lib/fileSniff";
import type { VaultFile } from "@/lib/types";

/** Adresse de lecture d'un fichier : servie par l'application (Google Drive ou ancien stockage Supabase). */
export function fileUrl(f: VaultFile, download = false): string {
  return `/api/files/${f.id}${download ? "?download=1" : ""}`;
}

export async function signFileUrl(f: VaultFile, download = false): Promise<string | null> {
  return fileUrl(f, download);
}

/** Dépose un fichier sur Google Drive via le serveur. */
export async function uploadVaultFile(file: File, documentId: string | null): Promise<{ file?: VaultFile; replaced?: VaultFile | null; error?: string }> {
  // Contrôle immédiat côté navigateur ; le serveur refait le même contrôle.
  const validation = await validateVaultFile(file);
  if (!validation.ok) return { error: validation.reason ?? "Fichier refusé." };
  const body = new FormData();
  body.append("file", file);
  if (documentId) body.append("documentId", documentId);
  const res = await fetch("/api/files", { method: "POST", body }).catch(() => null);
  if (!res) return { error: "Serveur injoignable." };
  const json = (await res.json().catch(() => ({}))) as { file?: VaultFile; replaced?: VaultFile | null; error?: string };
  if (!res.ok || !json.file) return { error: json.error ?? "Envoi refusé." };
  return { file: json.file, replaced: json.replaced ?? null };
}

export async function deleteVaultFile(id: string): Promise<string | null> {
  const res = await fetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res) return "Serveur injoignable.";
  if (res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error ?? "Suppression refusée.";
}
