import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";

interface Body {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** Enregistre l'abonnement push de cet appareil (titulaire uniquement). */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as Body;
    const endpoint = body.endpoint;
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;
    if (!endpoint || !/^https:\/\//.test(endpoint) || !p256dh || !auth || endpoint.length > 2000) {
      return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
    }
    const { error } = await supabase.from("push_subscription").upsert(
      { dossier_id: dossierId, user_id: userId, endpoint, p256dh, auth, user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Désabonne cet appareil. */
export async function DELETE(request: NextRequest) {
  try {
    const { supabase } = await requireOwner();
    const { endpoint } = (await request.json().catch(() => ({}))) as Body;
    if (!endpoint) return NextResponse.json({ error: "Adresse manquante." }, { status: 400 });
    await supabase.from("push_subscription").delete().eq("endpoint", endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
