import { NextResponse, type NextRequest } from "next/server";
import { validateVaultFile } from "@/lib/fileSniff";
import { ensureSubfolder, requireDrive, trashFile, uploadFile } from "@/lib/drive";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";
import { mapVaultFile } from "@/lib/queries";

/** Dépôt d'un fichier : toujours sur Google Drive. Refusé si Drive n'est pas joignable (aucun repli). */
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

    const { conn, token } = await requireDrive(dossierId);
    const folderId = await ensureSubfolder(conn, token, documentId ?? "divers", folderName);
    const name = safeFileName(file.name);
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
    return NextResponse.json({ file: mapVaultFile(data) });
  } catch (e) {
    return errorResponse(e);
  }
}
