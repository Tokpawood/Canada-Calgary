import { after, NextResponse, type NextRequest } from "next/server";
import { requireDrive, trashFile } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";

type Ctx = { params: Promise<{ id: string }> };

interface Removed {
  file_provider: string;
  file_storage_path: string | null;
  file_drive_id: string | null;
}

/**
 * Suppression d'une fiche document avec toutes ses pièces, en une seule transaction en base :
 * la fiche et ses scans disparaissent ensemble ou pas du tout. Le stockage et Google Drive
 * (corbeille, récupérable 30 jours) sont nettoyés ensuite.
 */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const { data, error } = await supabase.rpc("delete_document", { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const removed = (data ?? []) as Removed[];
    const paths = removed.filter((f) => f.file_provider === "supabase" && f.file_storage_path).map((f) => f.file_storage_path as string);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("coffre").remove(paths);
      if (storageError) console.error("[documents] nettoyage du stockage", storageError.message);
    }
    const driveIds = removed.map((f) => f.file_drive_id).filter((x): x is string => !!x);
    if (driveIds.length) {
      after(async () => {
        try {
          const { token } = await requireDrive(dossierId);
          for (const driveId of driveIds) await trashFile(token, driveId).catch((e) => console.error("[drive] corbeille", e));
        } catch (e) {
          console.error("[drive] corbeille", e);
        }
      });
    }
    return NextResponse.json({ ok: true, files: removed.length });
  } catch (e) {
    return errorResponse(e);
  }
}
