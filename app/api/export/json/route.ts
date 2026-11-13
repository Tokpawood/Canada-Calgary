import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser } from "@/lib/queries";
import { getFullBundle, toRawDossierJson } from "@/lib/exportData";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const dossier = await getDossierForUser(supabase);
  if (!dossier) return NextResponse.json({ error: "Aucun dossier" }, { status: 404 });

  const bundle = await getFullBundle(supabase, dossier);
  const json = JSON.stringify(toRawDossierJson(bundle), null, 2);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="etat-complet-${date}.json"`,
    },
  });
}
