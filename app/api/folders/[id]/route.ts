import { NextResponse, type NextRequest } from "next/server";
import { getConnection, renameItem, requireDrive, saveConnection, trashFile } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { cleanFolderName, mapFolder } from "@/lib/folders";

type Ctx = { params: Promise<{ id: string }> };

/** Renomme un dossier du Coffre, et son sous-dossier Drive s'il existe. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const { name } = (await request.json().catch(() => ({}))) as { name?: string };
    const clean = cleanFolderName(name);
    if (!clean) return NextResponse.json({ error: "Donnez un nom au dossier (80 caractères au plus)." }, { status: 400 });
    const { data, error } = await supabase.from("vault_folder").update({ name: clean }).eq("id", id).eq("dossier_id", dossierId).select("*").maybeSingle();
    if (error?.code === "23505") return NextResponse.json({ error: `Un dossier « ${clean} » existe déjà ici.` }, { status: 409 });
    if (error || !data) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
    const conn = await getConnection(dossierId);
    const driveId = conn?.folders[`folder:${id}`];
    if (driveId) {
      const { token } = await requireDrive(dossierId);
      await renameItem(token, driveId, clean).catch(() => null);
    }
    return NextResponse.json({ folder: mapFolder(data) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Supprime un dossier vide (ses anciennes versions archivées restent dans « Remplacés »). */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const [{ count }, { count: subCount }] = await Promise.all([
      supabase.from("file").select("id", { count: "exact", head: true }).eq("folder_id", id).is("replaced_at", null),
      supabase.from("vault_folder").select("id", { count: "exact", head: true }).eq("parent_id", id),
    ]);
    if (subCount) return NextResponse.json({ error: "Le dossier contient des sous-dossiers : supprimez-les d'abord." }, { status: 409 });
    if (count) return NextResponse.json({ error: "Le dossier contient encore des fichiers : déplacez-les ou supprimez-les d'abord." }, { status: 409 });
    const { error } = await supabase.from("vault_folder").delete().eq("id", id).eq("dossier_id", dossierId);
    if (error) return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
    const conn = await getConnection(dossierId);
    const key = `folder:${id}`;
    const driveId = conn?.folders[key];
    if (conn && driveId) {
      const { token } = await requireDrive(dossierId).catch(() => ({ token: null }));
      if (token) await trashFile(token, driveId).catch(() => null);
      const folders = { ...conn.folders };
      delete folders[key];
      await saveConnection(dossierId, { folders }).catch(() => null);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
