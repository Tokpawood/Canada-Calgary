import { NextResponse, type NextRequest } from "next/server";
import { validateVaultFile } from "@/lib/fileSniff";
import { ensureSubfolder, moveFile, replacedName, requireDrive, trashFile, uploadFile } from "@/lib/drive";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";
import { mapVaultFile } from "@/lib/queries";

const REPLACED_FOLDER = { key: "remplaces", name: "Fichiers remplacés" };

/**
 * Dépôt d'un fichier : toujours sur Google Drive. Refusé si Drive n'est pas joignable (aucun repli).
 * Même nom sur la même pièce : la nouvelle version remplace l'ancienne, qui est archivée
 * dans « Fichiers remplacés » (renommée avec la date) et reste consultable dans le Coffre.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

    const validation = await validateVaultFile(file);
    if (!validation.ok || !validation.mime) return NextResponse.json({ error: validation.reason ?? "Fichier refusé." }, { status: 400 });

    const documentId = (form?.get("documentId") as string | null) || null;
    let folderName = "Divers";
    if (documentId) {
      const { data: doc } = await supabase.from("document").select("id,name").eq("id", documentId).eq("dossier_id", dossierId).maybeSingle();
      if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
      folderName = (doc.name as string) || "Document";
    }
    const name = safeFileName(file.name);

    // Version actuelle portant le même nom sur la même pièce (insensible à la casse).
    let existingQuery = supabase.from("file").select("*").eq("dossier_id", dossierId).is("replaced_at", null).ilike("name", name.replace(/[\\%_]/g, "\\$&"));
    existingQuery = documentId ? existingQuery.eq("document_id", documentId) : existingQuery.is("document_id", null);
    const { data: existing } = await existingQuery.limit(1).maybeSingle();

    const { conn, token } = await requireDrive(dossierId);
    const folderId = await ensureSubfolder(conn, token, documentId ?? "divers", folderName);
    const driveId = await uploadFile(token, folderId, name, validation.mime, await file.arrayBuffer());

    const { data, error } = await supabase
      .from("file")
      .insert({ dossier_id: dossierId, document_id: documentId, provider: "gdrive", drive_file_id: driveId, storage_path: null, name, size: file.size, mime: validation.mime })
      .select("*")
      .single();
    if (error || !data) {
      await trashFile(token, driveId).catch(() => null);
      return NextResponse.json({ error: "Fichier envoyé mais non enregistré : réessayez." }, { status: 500 });
    }

    let replaced: ReturnType<typeof mapVaultFile> | null = null;
    if (existing) {
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
        replaced = mapVaultFile(old);
      } catch {
        // Archivage impossible : on annule le dépôt pour ne pas avoir deux versions actives.
        await supabase.from("file").delete().eq("id", data.id);
        await trashFile(token, driveId).catch(() => null);
        return NextResponse.json({ error: "Remplacement impossible : l'ancienne version n'a pas pu être archivée. Rien n'a été modifié." }, { status: 502 });
      }
    }

    return NextResponse.json({ file: mapVaultFile(data), replaced });
  } catch (e) {
    return errorResponse(e);
  }
}
