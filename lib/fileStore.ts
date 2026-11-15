import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DriveError, ensureSubfolder, moveFile, replacedName, trashFile, type DriveConnection } from "@/lib/drive";
import { mapVaultFile } from "@/lib/queries";
import type { VaultFile } from "@/lib/types";

const REPLACED_FOLDER = { key: "remplaces", name: "Fichiers remplacés" };

export interface Target {
  documentId: string | null;
  folderId: string | null;
  /** Clé et nom du sous-dossier Google Drive. */
  driveKey: string;
  driveName: string;
}

/** Où ranger un fichier : la pièce (Documents) prime, puis le dossier du Coffre, sinon « Divers ». */
export async function resolveTarget(supabase: SupabaseClient, dossierId: string, documentId: string | null, folderId: string | null): Promise<Target> {
  if (documentId) {
    const { data: doc } = await supabase.from("document").select("id,name").eq("id", documentId).eq("dossier_id", dossierId).maybeSingle();
    if (!doc) throw new DriveError("Document introuvable.", 404);
    return { documentId, folderId: null, driveKey: documentId, driveName: (doc.name as string) || "Document" };
  }
  if (folderId) {
    const { data: f } = await supabase.from("vault_folder").select("id,name").eq("id", folderId).eq("dossier_id", dossierId).maybeSingle();
    if (!f) throw new DriveError("Dossier introuvable.", 404);
    return { documentId: null, folderId, driveKey: `folder:${folderId}`, driveName: f.name as string };
  }
  return { documentId: null, folderId: null, driveKey: "divers", driveName: "Divers" };
}

export function driveFolderFor(conn: DriveConnection, token: string, t: Target): Promise<string> {
  return ensureSubfolder(conn, token, t.driveKey, t.driveName);
}

/**
 * Enregistre un fichier déjà présent sur Drive. Même nom au même endroit (pièce ou dossier) :
 * la nouvelle version remplace l'ancienne, archivée dans « Fichiers remplacés ».
 */
export async function registerFile(
  supabase: SupabaseClient,
  conn: DriveConnection,
  token: string,
  dossierId: string,
  t: Target,
  f: { driveId: string; name: string; size: number; mime: string },
): Promise<{ file: VaultFile; replaced: VaultFile | null }> {
  let q = supabase.from("file").select("*").eq("dossier_id", dossierId).is("replaced_at", null).ilike("name", f.name.replace(/[\\%_]/g, "\\$&"));
  q = t.documentId ? q.eq("document_id", t.documentId) : q.is("document_id", null);
  if (!t.documentId) q = t.folderId ? q.eq("folder_id", t.folderId) : q.is("folder_id", null);
  const { data: existing } = await q.limit(1).maybeSingle();

  const { data, error } = await supabase
    .from("file")
    .insert({ dossier_id: dossierId, document_id: t.documentId, folder_id: t.folderId, provider: "gdrive", drive_file_id: f.driveId, storage_path: null, name: f.name, size: f.size, mime: f.mime })
    .select("*")
    .single();
  if (error || !data) {
    await trashFile(token, f.driveId).catch(() => null);
    throw new DriveError("Fichier envoyé mais non enregistré : réessayez.", 500);
  }

  if (!existing) return { file: mapVaultFile(data), replaced: null };

  const now = new Date();
  const archivedName = replacedName(existing.name as string, now);
  try {
    if (existing.provider === "gdrive") {
      const archiveFolder = await ensureSubfolder(conn, token, REPLACED_FOLDER.key, REPLACED_FOLDER.name);
      await moveFile(token, existing.drive_file_id as string, archiveFolder, archivedName);
    }
    const { data: old, error: oldErr } = await supabase
      .from("file")
      .update({ replaced_at: now.toISOString(), replaced_by: data.id, name: archivedName })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (oldErr || !old) throw new Error(oldErr?.message ?? "mise à jour impossible");
    return { file: mapVaultFile(data), replaced: mapVaultFile(old) };
  } catch {
    // Archivage impossible : on annule le dépôt pour ne pas avoir deux versions actives.
    await supabase.from("file").delete().eq("id", data.id);
    await trashFile(token, f.driveId).catch(() => null);
    throw new DriveError("Remplacement impossible : l'ancienne version n'a pas pu être archivée. Rien n'a été modifié.", 502);
  }
}
