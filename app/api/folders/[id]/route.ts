import { after, NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureRootFolder, getConnection, moveFile, renameItem, requireDrive, saveConnection, trashFile } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { driveFolderFor, resolveTarget } from "@/lib/fileStore";
import { canMoveInto, cleanFolderName, mapFolder } from "@/lib/folders";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** Renomme un dossier du Coffre (ou le déplace avec `parentId`), et son dossier Drive s'il existe. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as { name?: string; parentId?: string | null };
    if ("parentId" in body) return move(supabase, dossierId, id, body.parentId ?? null);
    const { name } = body;
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

/** Déplace un dossier (avec tout son contenu) dans un autre dossier, ou à la racine du Coffre. */
async function move(supabase: SupabaseClient, dossierId: string, id: string, parentId: string | null) {
  const { data: rows } = await supabase.from("vault_folder").select("*").eq("dossier_id", dossierId);
  const folders = (rows ?? []).map(mapFolder);
  const self = folders.find((f) => f.id === id);
  if (!self) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  if (self.parentId === parentId) return NextResponse.json({ folder: self });
  if (!canMoveInto(folders, id, parentId)) return NextResponse.json({ error: "Impossible de déplacer un dossier dans lui-même ou dans un de ses sous-dossiers." }, { status: 400 });

  const { data, error } = await supabase.from("vault_folder").update({ parent_id: parentId }).eq("id", id).eq("dossier_id", dossierId).select("*").maybeSingle();
  if (error?.code === "23505") return NextResponse.json({ error: `Un dossier « ${self.name} » existe déjà à cet endroit.` }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "Déplacement impossible." }, { status: 500 });

  // Sur Drive, le dossier (et donc son contenu) suit, en arrière-plan.
  after(async () => {
    const conn = await getConnection(dossierId);
    const driveId = conn?.folders[`folder:${id}`];
    if (!conn?.refreshToken || !driveId) return;
    const { token } = await requireDrive(dossierId);
    const admin = createAdminClient();
    const dest = parentId ? await driveFolderFor(conn, token, await resolveTarget(admin, dossierId, null, parentId)) : await ensureRootFolder(token, conn.rootFolderId);
    await moveFile(token, driveId, dest, self.name);
  });
  return NextResponse.json({ folder: mapFolder(data) });
}
