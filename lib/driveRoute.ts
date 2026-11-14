import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DriveError } from "@/lib/drive";

/** Utilisateur connecté et dossier dont il est titulaire (pas un simple lecteur invité). */
export async function requireOwner(): Promise<{ supabase: SupabaseClient; userId: string; dossierId: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new DriveError("Non authentifié.", 401);
  const { data: dossier } = await supabase.from("dossier").select("id").eq("owner_id", data.user.id).maybeSingle();
  if (!dossier) throw new DriveError("Réservé au titulaire du dossier.", 403);
  return { supabase, userId: data.user.id, dossierId: dossier.id as string };
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof DriveError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[drive]", e);
  return NextResponse.json({ error: "Erreur inattendue côté serveur." }, { status: 500 });
}

export function safeFileName(name: string): string {
  return name.replace(/[\u0000-\u001f"\\]/g, "_").slice(0, 200) || "fichier";
}
