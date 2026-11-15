import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_MIME, MAX_FILE_SIZE, sniffBytes } from "@/lib/fileSniff";
import { fileMeta, readHead, requireDrive, trashFile } from "@/lib/drive";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";
import { driveFolderFor, registerFile, resolveTarget } from "@/lib/fileStore";

interface Body {
  driveFileId?: string;
  documentId?: string | null;
  folderId?: string | null;
}

/**
 * Étape 2 de l'envoi direct : contrôle du fichier arrivé sur Drive (bon dossier, taille, type réel
 * lu dans ses premiers octets) puis enregistrement. Un fichier non conforme part à la corbeille.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const b = (await request.json().catch(() => ({}))) as Body;
    if (!b.driveFileId || !/^[\w-]{10,200}$/.test(b.driveFileId)) return NextResponse.json({ error: "Envoi inconnu." }, { status: 400 });

    const [target, { conn, token }] = await Promise.all([resolveTarget(supabase, dossierId, b.documentId || null, b.folderId || null), requireDrive(dossierId)]);
    const [folderId, meta, head] = await Promise.all([driveFolderFor(conn, token, target), fileMeta(token, b.driveFileId), readHead(token, b.driveFileId).catch(() => new Uint8Array())]);
    if (!meta || meta.trashed || !meta.parents.includes(folderId)) return NextResponse.json({ error: "Fichier envoyé introuvable dans le dossier attendu." }, { status: 400 });

    const mime = sniffBytes(head);
    if (!mime || !(ALLOWED_MIME as readonly string[]).includes(mime) || meta.size > MAX_FILE_SIZE) {
      await trashFile(token, meta.id).catch(() => null);
      return NextResponse.json({ error: "Type de fichier non accepté (PDF, JPEG, PNG ou WEBP uniquement)." }, { status: 400 });
    }

    // Un fichier ne peut être enregistré qu'une fois.
    const { data: dup } = await supabase.from("file").select("id").eq("drive_file_id", meta.id).maybeSingle();
    if (dup) return NextResponse.json({ error: "Fichier déjà enregistré." }, { status: 409 });

    return NextResponse.json(await registerFile(supabase, conn, token, dossierId, target, { driveId: meta.id, name: safeFileName(meta.name), size: meta.size, mime }));
  } catch (e) {
    return errorResponse(e);
  }
}
