import { NextResponse, type NextRequest } from "next/server";
import { downloadFile, moveFile, requireDrive, trashFile } from "@/lib/drive";
import { driveFolderFor, resolveTarget } from "@/lib/fileStore";
import { mapVaultFile } from "@/lib/queries";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";

type Ctx = { params: Promise<{ id: string }> };

async function loadFile(id: string) {
  const owner = await requireOwner();
  // RLS : seul le titulaire du dossier voit la ligne.
  const { data } = await owner.supabase.from("file").select("*").eq("id", id).maybeSingle();
  return { ...owner, row: data };
}

/** Lecture d'un fichier (aperçu ou téléchargement), servie par l'application après contrôle d'accès. */
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId, row } = await loadFile(id);
    if (!row) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
    const download = request.nextUrl.searchParams.has("download");
    const name = safeFileName(row.name as string);

    if (row.provider === "supabase") {
      const { data } = await supabase.storage.from("coffre").createSignedUrl(row.storage_path as string, 300, download ? { download: name } : undefined);
      if (!data?.signedUrl) return NextResponse.json({ error: "Lien indisponible." }, { status: 404 });
      return NextResponse.redirect(data.signedUrl);
    }

    const { token } = await requireDrive(dossierId);
    const upstream = await downloadFile(token, row.drive_file_id as string);
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": row.mime as string,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Suppression : corbeille Google Drive (récupérable 30 jours) puis retrait de la fiche. */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId, row } = await loadFile(id);
    if (!row) return NextResponse.json({ ok: true });
    if (row.provider === "gdrive") {
      const { token } = await requireDrive(dossierId);
      await trashFile(token, row.drive_file_id as string);
    } else {
      await supabase.storage.from("coffre").remove([row.storage_path as string]);
    }
    const { error } = await supabase.from("file").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Classement : déplace le fichier dans un dossier du Coffre (ou le sort de tout dossier), y compris sur Drive. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId, row } = await loadFile(id);
    if (!row) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
    const { folderId = null } = (await request.json().catch(() => ({}))) as { folderId?: string | null };
    if ((row.folder_id ?? null) === folderId) return NextResponse.json({ file: mapVaultFile(row) });

    if (row.provider === "gdrive" && !row.replaced_at) {
      // La pièce rattachée garde la priorité pour l'emplacement Drive ; sinon on suit le dossier.
      const target = await resolveTarget(supabase, dossierId, (row.document_id as string | null) ?? null, folderId);
      if (!row.document_id) {
        const { conn, token } = await requireDrive(dossierId);
        const driveFolder = await driveFolderFor(conn, token, target);
        await moveFile(token, row.drive_file_id as string, driveFolder, row.name as string);
      }
    } else if (folderId) {
      await resolveTarget(supabase, dossierId, null, folderId);
    }
    const { data, error } = await supabase.from("file").update({ folder_id: folderId }).eq("id", id).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Classement non enregistré." }, { status: 500 });
    return NextResponse.json({ file: mapVaultFile(data) });
  } catch (e) {
    return errorResponse(e);
  }
}
