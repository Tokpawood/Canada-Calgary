import { NextResponse } from "next/server";
import { ensureSubfolder, requireDrive, trashFile, uploadFile } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";

/** Copie les fichiers encore stockés dans Supabase vers Google Drive, puis les retire de Supabase. */
export async function POST() {
  try {
    const { supabase, dossierId } = await requireOwner();
    const { conn, token } = await requireDrive(dossierId);
    const { data: rows } = await supabase.from("file").select("*").eq("dossier_id", dossierId).eq("provider", "supabase");
    const { data: docs } = await supabase.from("document").select("id,name").eq("dossier_id", dossierId);
    const docName = new Map((docs ?? []).map((d) => [d.id as string, d.name as string]));

    let moved = 0;
    const failed: string[] = [];
    for (const row of rows ?? []) {
      const path = row.storage_path as string;
      try {
        const { data: blob, error } = await supabase.storage.from("coffre").download(path);
        if (error || !blob) throw new Error("lecture Supabase impossible");
        const documentId = (row.document_id as string | null) ?? null;
        const folderId = await ensureSubfolder(conn, token, documentId ?? "divers", (documentId && docName.get(documentId)) || "Divers");
        const driveId = await uploadFile(token, folderId, row.name as string, row.mime as string, await blob.arrayBuffer());
        const { error: upErr } = await supabase.from("file").update({ provider: "gdrive", drive_file_id: driveId, storage_path: null }).eq("id", row.id);
        if (upErr) {
          await trashFile(token, driveId).catch(() => null);
          throw new Error(upErr.message);
        }
        await supabase.storage.from("coffre").remove([path]);
        moved += 1;
      } catch {
        failed.push(row.name as string);
      }
    }
    return NextResponse.json({ moved, failed });
  } catch (e) {
    return errorResponse(e);
  }
}
