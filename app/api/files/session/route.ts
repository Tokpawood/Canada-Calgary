import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_MIME, MAX_FILE_SIZE } from "@/lib/fileSniff";
import { requireDrive, startUpload } from "@/lib/drive";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";
import { driveFolderFor, resolveTarget } from "@/lib/fileStore";

interface Body {
  name?: string;
  size?: number;
  mime?: string;
  documentId?: string | null;
  folderId?: string | null;
}

/**
 * Étape 1 de l'envoi direct : le serveur ouvre une session d'envoi Google Drive dans le bon dossier
 * et renvoie son adresse ; le navigateur y envoie le fichier sans passer par le serveur.
 * Le type réel est revérifié à l'étape 2 (/api/files/commit).
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const b = (await request.json().catch(() => ({}))) as Body;
    const size = Number(b.size);
    if (!b.name || !Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
    if (size > MAX_FILE_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (20 Mo maximum)." }, { status: 400 });
    if (!b.mime || !(ALLOWED_MIME as readonly string[]).includes(b.mime)) return NextResponse.json({ error: "Type de fichier non accepté (PDF, JPEG, PNG ou WEBP uniquement)." }, { status: 400 });

    const [target, { conn, token }] = await Promise.all([resolveTarget(supabase, dossierId, b.documentId || null, b.folderId || null), requireDrive(dossierId)]);
    const folderId = await driveFolderFor(conn, token, target);
    const origin = request.headers.get("origin") ?? request.nextUrl.origin;
    const uploadUrl = await startUpload(token, folderId, safeFileName(b.name), b.mime, size, origin);
    return NextResponse.json({ uploadUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
