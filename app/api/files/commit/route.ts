import { after, NextResponse, type NextRequest } from "next/server";
import { ALLOWED_MIME, MAX_FILE_SIZE, sniffBytes } from "@/lib/fileSniff";
import { errorResponse, requireOwner, safeFileName } from "@/lib/driveRoute";
import { BUCKET, archiveOnDrive, backupToDrive, registerStored, resolveTarget } from "@/lib/fileStore";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

interface Body {
  path?: string;
  name?: string;
  documentId?: string | null;
  folderId?: string | null;
}

/** Premiers octets et taille d'un objet du stockage, sans le télécharger en entier. */
async function probe(path: string): Promise<{ head: Uint8Array; size: number } | null> {
  const storage = createAdminClient().storage.from(BUCKET);
  const { data } = await storage.createSignedUrl(path, 60);
  if (!data?.signedUrl) return null;
  const res = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" } }).catch(() => null);
  if (!res || !res.ok) return null;
  const head = new Uint8Array(await res.arrayBuffer()).slice(0, 16);
  let size = Number(res.headers.get("content-range")?.split("/")[1] ?? NaN);
  if (!Number.isFinite(size)) {
    const { data: info } = await storage.info(path);
    size = Number((info as { size?: number } | null)?.size ?? 0);
  }
  return { head, size };
}

/**
 * Étape 2 du dépôt : contrôle du fichier reçu (type réel, taille), enregistrement,
 * puis copie de sauvegarde sur Google Drive après la réponse (le dépôt n'attend pas Drive).
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const b = (await request.json().catch(() => ({}))) as Body;
    const path = b.path ?? "";
    if (!new RegExp(`^${dossierId}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$`).test(path)) return NextResponse.json({ error: "Envoi inconnu." }, { status: 400 });

    const target = await resolveTarget(supabase, dossierId, b.documentId || null, b.folderId || null);
    const got = await probe(path);
    if (!got) return NextResponse.json({ error: "Fichier non reçu : réessayez." }, { status: 400 });
    const mime = sniffBytes(got.head);
    if (!mime || !(ALLOWED_MIME as readonly string[]).includes(mime) || got.size > MAX_FILE_SIZE) {
      await createAdminClient().storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: "Type de fichier non accepté (PDF, JPEG, PNG ou WEBP uniquement)." }, { status: 400 });
    }

    const { data: dup } = await supabase.from("file").select("id").eq("storage_path", path).maybeSingle();
    if (dup) return NextResponse.json({ error: "Fichier déjà enregistré." }, { status: 409 });

    const res = await registerStored(supabase, dossierId, target, { path, name: safeFileName(b.name || "fichier"), size: got.size, mime });

    // Sauvegarde Drive en arrière-plan : la réponse part tout de suite.
    after(async () => {
      if (res.archive) await archiveOnDrive(dossierId, res.archive).catch((e) => console.error("[drive] archivage", e));
      await backupToDrive(dossierId, [res.file.id]).catch((e) => console.error("[drive] sauvegarde", e));
    });
    return NextResponse.json({ file: res.file, replaced: res.replaced });
  } catch (e) {
    return errorResponse(e);
  }
}
