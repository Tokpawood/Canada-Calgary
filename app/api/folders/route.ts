import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { cleanFolderName, mapFolder } from "@/lib/folders";

/** Crée un dossier du Coffre (le sous-dossier Drive est créé au premier dépôt). */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const { name } = (await request.json().catch(() => ({}))) as { name?: string };
    const clean = cleanFolderName(name);
    if (!clean) return NextResponse.json({ error: "Donnez un nom au dossier (80 caractères au plus)." }, { status: 400 });
    const { data, error } = await supabase.from("vault_folder").insert({ dossier_id: dossierId, name: clean }).select("*").single();
    if (error?.code === "23505") return NextResponse.json({ error: `Un dossier « ${clean} » existe déjà.` }, { status: 409 });
    if (error || !data) return NextResponse.json({ error: "Création impossible." }, { status: 500 });
    return NextResponse.json({ folder: mapFolder(data) });
  } catch (e) {
    return errorResponse(e);
  }
}
