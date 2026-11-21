import { after, NextResponse, type NextRequest } from "next/server";
import { downloadFile, requireDrive, trashFile } from "@/lib/drive";
import { relocateOnDrive, resolveTarget } from "@/lib/fileStore";
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

/** Suppression : retrait du stockage de l'application et copie Drive mise à la corbeille (récupérable 30 jours). */
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
      if (row.drive_file_id) {
        const driveId = row.drive_file_id as string;
        after(async () => {
          try {
            const { token } = await requireDrive(dossierId);
            await trashFile(token, driveId);
          } catch (e) {
            console.error("[drive] corbeille", e);
          }
        });
      }
    }
    const { error } = await supabase.from("file").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Classement : range le fichier dans un dossier du Coffre (`folderId`) et/ou le lie à une pièce
 * de Documents (`documentId`, null pour le détacher). La copie Drive suit en arrière-plan.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId, row } = await loadFile(id);
    if (!row) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { folderId?: string | null; documentId?: string | null };
    const oldFolder = (row.folder_id as string | null) ?? null;
    const oldDoc = (row.document_id as string | null) ?? null;
    const folderId = "folderId" in body ? (body.folderId ?? null) : oldFolder;
    const documentId = "documentId" in body ? (body.documentId ?? null) : oldDoc;
    if (folderId === oldFolder && documentId === oldDoc) return NextResponse.json({ file: mapVaultFile(row) });
    if (documentId !== oldDoc && row.replaced_at) return NextResponse.json({ error: "Une ancienne version ne peut pas être liée à une pièce." }, { status: 400 });

    // Vérifie que la pièce et le dossier appartiennent bien au dossier du titulaire.
    const target = await resolveTarget(supabase, dossierId, documentId, folderId);
    const { data, error } = await supabase.from("file").update({ folder_id: folderId, document_id: documentId }).eq("id", id).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Modification non enregistrée." }, { status: 500 });

    // Sur Drive, la pièce rattachée garde la priorité pour l'emplacement ; sinon la copie suit le dossier.
    const moves = documentId !== oldDoc || (!documentId && folderId !== oldFolder);
    if (row.drive_file_id && !row.replaced_at && moves) {
      const driveId = row.drive_file_id as string;
      const name = row.name as string;
      after(() => relocateOnDrive(dossierId, driveId, name, target).catch((e) => console.error("[drive] déplacement", e)));
    }
    return NextResponse.json({ file: mapVaultFile(data) });
  } catch (e) {
    return errorResponse(e);
  }
}
