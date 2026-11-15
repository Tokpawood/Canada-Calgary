import { NextResponse, type NextRequest } from "next/server";
import { validateVaultFile } from "@/lib/fileSniff";
import { requireDrive, uploadFile } from "@/lib/drive";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";
import { driveFolderFor, registerFile, resolveTarget } from "@/lib/fileStore";

/**
 * Dépôt « relais » (le fichier transite par le serveur). Utilisé seulement si l'envoi direct
 * du navigateur vers Google Drive échoue ; limité par la taille de requête du serveur (~4 Mo).
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

    const validation = await validateVaultFile(file);
    if (!validation.ok || !validation.mime) return NextResponse.json({ error: validation.reason ?? "Fichier refusé." }, { status: 400 });

    const [target, { conn, token }] = await Promise.all([
      resolveTarget(supabase, dossierId, (form?.get("documentId") as string | null) || null, (form?.get("folderId") as string | null) || null),
      requireDrive(dossierId),
    ]);
    const name = safeFileName(file.name);
    const folderId = await driveFolderFor(conn, token, target);
    const driveId = await uploadFile(token, folderId, name, validation.mime, await file.arrayBuffer());
    return NextResponse.json(await registerFile(supabase, conn, token, dossierId, target, { driveId, name, size: file.size, mime: validation.mime }));
  } catch (e) {
    return errorResponse(e);
  }
}
