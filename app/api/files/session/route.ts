import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_MIME, MAX_FILE_SIZE } from "@/lib/fileSniff";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { BUCKET, resolveTarget } from "@/lib/fileStore";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  size?: number;
  mime?: string;
  documentId?: string | null;
  folderId?: string | null;
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Étape 1 du dépôt : adresse d'envoi à usage unique (2 h) vers le stockage de l'application.
 * Le navigateur y envoie le fichier (avec barre d'avancement) ; l'étape 2 (/api/files/commit)
 * revérifie le fichier reçu, l'enregistre, puis lance la copie de sauvegarde sur Google Drive.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const b = (await request.json().catch(() => ({}))) as Body;
    const size = Number(b.size);
    if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "Fichier vide ou invalide." }, { status: 400 });
    if (size > MAX_FILE_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (20 Mo maximum)." }, { status: 400 });
    if (!b.mime || !(ALLOWED_MIME as readonly string[]).includes(b.mime)) return NextResponse.json({ error: "Type de fichier non accepté (PDF, JPEG, PNG ou WEBP uniquement)." }, { status: 400 });
    await resolveTarget(supabase, dossierId, b.documentId || null, b.folderId || null);

    const path = `${dossierId}/${randomUUID()}.${EXT[b.mime]}`;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl) return NextResponse.json({ error: "Envoi impossible pour le moment : réessayez." }, { status: 502 });
    return NextResponse.json({ uploadUrl: data.signedUrl, path });
  } catch (e) {
    return errorResponse(e);
  }
}
