import { after, NextResponse, type NextRequest } from "next/server";
import { downloadFile, requireDrive } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { BUCKET, archiveOnDrive, backupToDrive, registerStored, resolveTarget } from "@/lib/fileStore";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Copie d'un fichier dans un dossier du Coffre. L'original ne bouge pas et reste lié à sa pièce (Documents) ;
 * la copie est indépendante, rangée dans le dossier choisi, et sauvegardée sur Drive en arrière-plan.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const { folderId = null } = (await request.json().catch(() => ({}))) as { folderId?: string | null };
    const { data: row } = await supabase.from("file").select("*").eq("id", id).eq("dossier_id", dossierId).maybeSingle();
    if (!row) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
    if (row.replaced_at) return NextResponse.json({ error: "Une ancienne version ne se copie pas." }, { status: 400 });
    const ext = EXT[row.mime as string];
    if (!ext) return NextResponse.json({ error: "Type de fichier non pris en charge." }, { status: 400 });

    const target = await resolveTarget(supabase, dossierId, null, folderId || null);
    const storage = createAdminClient().storage.from(BUCKET);
    const path = `${dossierId}/${crypto.randomUUID()}.${ext}`;

    if (row.provider === "supabase") {
      const { error } = await storage.copy(row.storage_path as string, path);
      if (error) return NextResponse.json({ error: "Copie impossible : réessayez." }, { status: 500 });
    } else {
      // Ancien fichier présent seulement sur Drive : il est rapatrié dans l'application.
      const { token } = await requireDrive(dossierId);
      const upstream = await downloadFile(token, row.drive_file_id as string);
      const body = new Uint8Array(await upstream.arrayBuffer());
      const { error } = await storage.upload(path, body, { contentType: row.mime as string });
      if (error) return NextResponse.json({ error: "Copie impossible : réessayez." }, { status: 500 });
    }

    const res = await registerStored(supabase, dossierId, target, { path, name: row.name as string, size: Number(row.size ?? 0), mime: row.mime as string });
    after(async () => {
      if (res.archive) await archiveOnDrive(dossierId, res.archive).catch((e) => console.error("[drive] archivage", e));
      await backupToDrive(dossierId, [res.file.id]).catch((e) => console.error("[drive] sauvegarde", e));
    });
    return NextResponse.json({ file: res.file, replaced: res.replaced });
  } catch (e) {
    return errorResponse(e);
  }
}
