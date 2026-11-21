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
/**
 * Supprime un dossier avec tout ce qu'il contient : sous-dossiers et fichiers non rattachés
 * (mis à la corbeille Drive, récupérables 30 jours). Les fichiers liés à une pièce de Documents
 * sont conservés : ils restent sur leur pièce et deviennent « non classés ».
 */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const { data: rows } = await supabase.from("vault_folder").select("*").eq("dossier_id", dossierId);
    const folders = (rows ?? []).map(mapFolder);
    if (!folders.some((f) => f.id === id)) return NextResponse.json({ ok: true, deletedFiles: [], deletedFolders: [] });

    // Le dossier et ses descendants, du plus profond au plus haut (la clé parent interdit l'inverse).
    const tree: string[] = [];
    const walk = (fid: string) => {
      for (const c of folders.filter((f) => f.parentId === fid)) walk(c.id);
      tree.push(fid);
    };
    walk(id);

    const { data: fileRows } = await supabase.from("file").select("*").eq("dossier_id", dossierId).in("folder_id", tree);
    const doomed = (fileRows ?? []).filter((f) => !f.document_id);

    const storagePaths = doomed.filter((f) => f.provider !== "gdrive" && f.storage_path).map((f) => f.storage_path as string);
    if (storagePaths.length) await supabase.storage.from("coffre").remove(storagePaths);
    if (doomed.length) {
      const { error } = await supabase.from("file").delete().in("id", doomed.map((f) => f.id as string));
      if (error) return NextResponse.json({ error: "Les fichiers du dossier n'ont pas pu être supprimés." }, { status: 500 });
    }
    for (const fid of tree) {
      const { error } = await supabase.from("vault_folder").delete().eq("id", fid).eq("dossier_id", dossierId);
      if (error) return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
    }

    // Drive : fichiers puis dossiers à la corbeille, en arrière-plan.
    const driveFiles = doomed.map((f) => f.drive_file_id as string | null).filter((x): x is string => Boolean(x));
    after(async () => {
      try {
        const conn = await getConnection(dossierId);
        if (!conn) return;
        const { token } = await requireDrive(dossierId).catch(() => ({ token: null }));
        if (token) {
          for (const d of driveFiles) await trashFile(token, d).catch(() => null);
          for (const fid of tree) {
            const driveId = conn.folders[`folder:${fid}`];
            if (driveId) await trashFile(token, driveId).catch(() => null);
          }
        }
        const kept = { ...conn.folders };
        for (const fid of tree) delete kept[`folder:${fid}`];
        await saveConnection(dossierId, { folders: kept }).catch(() => null);
      } catch (e) {
        console.error("[drive] suppression de dossier", e);
      }
    });

    return NextResponse.json({ ok: true, deletedFiles: doomed.map((f) => f.id as string), deletedFolders: tree });
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
    try {
      const conn = await getConnection(dossierId);
      const driveId = conn?.folders[`folder:${id}`];
      if (!conn?.refreshToken || !driveId) return;
      const { token } = await requireDrive(dossierId);
      const admin = createAdminClient();
      const dest = parentId ? await driveFolderFor(conn, token, await resolveTarget(admin, dossierId, null, parentId)) : await ensureRootFolder(token, conn.rootFolderId);
      await moveFile(token, driveId, dest, self.name);
    } catch (e) {
      console.error("[drive] déplacement du dossier", e);
    }
  });
  return NextResponse.json({ folder: mapFolder(data) });
}
