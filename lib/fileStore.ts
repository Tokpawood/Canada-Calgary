import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DriveError, ensureSubfolder, folderUsable, getConnection, moveFile, replacedName, requireDrive, trashFile, uploadFile, type DriveConnection } from "@/lib/drive";
import { folderChain, mapFolder, type VaultFolder } from "@/lib/folders";
import { mapVaultFile } from "@/lib/queries";
import type { VaultFile } from "@/lib/types";

export const BUCKET = "coffre";
const REPLACED_FOLDER = { key: "remplaces", name: "Fichiers remplacés" };

export interface Target {
  documentId: string | null;
  documentName: string | null;
  folderId: string | null;
  /** Dossiers du Coffre de la racine jusqu'au dossier visé. */
  chain: VaultFolder[];
}

/** Où ranger un fichier : la pièce (Documents) ou un dossier du Coffre (avec ses parents), sinon « Divers ». */
export async function resolveTarget(supabase: SupabaseClient, dossierId: string, documentId: string | null, folderId: string | null): Promise<Target> {
  let documentName: string | null = null;
  if (documentId) {
    const { data: doc } = await supabase.from("document").select("id,name").eq("id", documentId).eq("dossier_id", dossierId).maybeSingle();
    if (!doc) throw new DriveError("Document introuvable.", 404);
    documentName = (doc.name as string) || "Document";
  }
  let chain: VaultFolder[] = [];
  if (folderId) {
    const { data: rows } = await supabase.from("vault_folder").select("*").eq("dossier_id", dossierId);
    chain = folderChain((rows ?? []).map(mapFolder), folderId);
    if (!chain.length) throw new DriveError("Dossier introuvable.", 404);
  }
  return { documentId, documentName, folderId: folderId || null, chain };
}

/** Dossier Drive de destination ; les dossiers du Coffre reproduisent leur arborescence sur Drive. */
export async function driveFolderFor(conn: DriveConnection, token: string, t: Target): Promise<string> {
  if (t.documentId) return ensureSubfolder(conn, token, t.documentId, t.documentName ?? "Document");
  if (!t.chain.length) return ensureSubfolder(conn, token, "divers", "Divers");
  const leaf = conn.folders[`folder:${t.chain[t.chain.length - 1].id}`];
  if (conn.rootFolderId && leaf && (await folderUsable(token, leaf))) return leaf;
  let parent: string | undefined;
  for (const f of t.chain) parent = await ensureSubfolder(conn, token, `folder:${f.id}`, f.name, parent);
  return parent!;
}

/**
 * Enregistre un fichier déposé dans le stockage de l'application. Même nom au même endroit
 * (pièce ou dossier) : la nouvelle version remplace l'ancienne, qui reste visible dans « Remplacés ».
 * Renvoie aussi la copie Drive de l'ancienne version, à archiver sur Drive en arrière-plan.
 */
export async function registerStored(
  supabase: SupabaseClient,
  dossierId: string,
  t: Target,
  f: { path: string; name: string; size: number; mime: string },
): Promise<{ file: VaultFile; replaced: VaultFile | null; archive: { driveId: string; name: string } | null }> {
  let q = supabase.from("file").select("*").eq("dossier_id", dossierId).is("replaced_at", null).ilike("name", f.name.replace(/[\\%_]/g, "\\$&"));
  q = t.documentId ? q.eq("document_id", t.documentId) : q.is("document_id", null);
  if (!t.documentId) q = t.folderId ? q.eq("folder_id", t.folderId) : q.is("folder_id", null);
  const { data: existing } = await q.limit(1).maybeSingle();

  const { data, error } = await supabase
    .from("file")
    .insert({ dossier_id: dossierId, document_id: t.documentId, folder_id: t.folderId, provider: "supabase", storage_path: f.path, name: f.name, size: f.size, mime: f.mime })
    .select("*")
    .single();
  if (error || !data) throw new DriveError("Fichier reçu mais non enregistré : réessayez.", 500);
  if (!existing) return { file: mapVaultFile(data), replaced: null, archive: null };

  const now = new Date();
  const archivedName = replacedName(existing.name as string, now);
  const { data: old } = await supabase
    .from("file")
    .update({ replaced_at: now.toISOString(), replaced_by: data.id, name: archivedName })
    .eq("id", existing.id)
    .select("*")
    .single();
  return {
    file: mapVaultFile(data),
    replaced: old ? mapVaultFile(old) : null,
    archive: existing.drive_file_id ? { driveId: existing.drive_file_id as string, name: archivedName } : null,
  };
}

/** Range l'ancienne version sur Drive dans « Fichiers remplacés » (au mieux, sans bloquer). */
export async function archiveOnDrive(dossierId: string, a: { driveId: string; name: string }): Promise<void> {
  const conn = await getConnection(dossierId);
  if (!conn?.refreshToken) return;
  const { token } = await requireDrive(dossierId);
  const folder = await ensureSubfolder(conn, token, REPLACED_FOLDER.key, REPLACED_FOLDER.name);
  await moveFile(token, a.driveId, folder, a.name);
}

/**
 * Sauvegarde sur Google Drive des fichiers stockés dans l'application et pas encore copiés.
 * `ids` : seulement ces fichiers (après un dépôt) ; sinon tous ceux en attente du dossier.
 */
export async function backupToDrive(dossierId: string, ids?: string[]): Promise<{ saved: number; failed: string[]; skipped?: string }> {
  const admin = createAdminClient();
  const conn = await getConnection(dossierId);
  if (!conn?.refreshToken) return { saved: 0, failed: [], skipped: "Google Drive non connecté" };
  const { token } = await requireDrive(dossierId);

  let q = admin.from("file").select("*").eq("dossier_id", dossierId).eq("provider", "supabase").is("drive_file_id", null).is("replaced_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { data: rows } = await q.order("uploaded_at").limit(50);

  let saved = 0;
  const failed: string[] = [];
  for (const row of rows ?? []) {
    try {
      const target = await resolveTarget(admin, dossierId, (row.document_id as string | null) ?? null, (row.folder_id as string | null) ?? null).catch(() =>
        resolveTarget(admin, dossierId, null, null),
      );
      const folder = await driveFolderFor(conn, token, target);
      const { data: blob, error } = await admin.storage.from(BUCKET).download(row.storage_path as string);
      if (error || !blob) throw new Error("lecture du stockage impossible");
      const driveId = await uploadFile(token, folder, row.name as string, row.mime as string, await blob.arrayBuffer());
      const { error: upErr } = await admin.from("file").update({ drive_file_id: driveId, drive_backup_at: new Date().toISOString(), drive_backup_error: null }).eq("id", row.id);
      if (upErr) {
        await trashFile(token, driveId).catch(() => null);
        throw new Error(upErr.message);
      }
      saved++;
    } catch (e) {
      failed.push(row.name as string);
      await admin.from("file").update({ drive_backup_error: e instanceof Error ? e.message.slice(0, 300) : "erreur" }).eq("id", row.id);
    }
  }
  return { saved, failed };
}

/** Place la copie Drive d'un fichier dans le dossier Drive correspondant à son classement (au mieux). */
export async function relocateOnDrive(dossierId: string, driveId: string, name: string, t: Target): Promise<void> {
  const conn = await getConnection(dossierId);
  if (!conn?.refreshToken) return;
  const { token } = await requireDrive(dossierId);
  await moveFile(token, driveId, await driveFolderFor(conn, token, t), name);
}
