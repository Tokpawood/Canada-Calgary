import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { PHOTO_BUCKET } from "@/lib/queries";
import { WebImageError, fetchWebImage } from "@/lib/webImage";

export const maxDuration = 30;

/** Photo d'un organisme ou d'une personne récupérée sur internet (image ou site), enregistrée dans le stockage privé. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as { kind?: string; id?: string; url?: string };
    const kind = body.kind === "org" ? "org" : body.kind === "person" ? "person" : null;
    if (!kind || typeof body.id !== "string" || typeof body.url !== "string" || body.url.length > 2000) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    const table = kind === "org" ? "contact" : "contact_person";
    const { data: row } = await supabase.from(table).select("id,photo_path").eq("id", body.id).eq("dossier_id", dossierId).maybeSingle();
    if (!row) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });

    let jpeg: Buffer;
    try {
      jpeg = await fetchWebImage(body.url, kind === "org" ? "contain" : "cover");
    } catch (e) {
      const msg = e instanceof WebImageError ? e.message : "Image illisible : essayez une autre adresse.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const path = `${dossierId}/${kind}-${body.id}-${Date.now().toString(36)}.jpg`;
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "3600" });
    if (upErr) return NextResponse.json({ error: "Enregistrement de l'image impossible." }, { status: 500 });
    const { error } = await supabase.from(table).update({ photo_path: path }).eq("id", body.id);
    if (error) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      return NextResponse.json({ error: "Enregistrement de l'image impossible." }, { status: 500 });
    }
    if (row.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([row.photo_path as string]);
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 6);
    return NextResponse.json({ path, url: data?.signedUrl ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
