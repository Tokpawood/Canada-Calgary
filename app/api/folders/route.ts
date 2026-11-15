import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { cleanFolderName, mapFolder } from "@/lib/folders";

/** Crée un dossier du Coffre, à la racine ou dans un autre dossier (le dossier Drive est créé au premier fichier). */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const { name, parentId = null } = (await request.json().catch(() => ({}))) as { name?: string; parentId?: string | null };
    const clean = cleanFolderName(name);
    if (!clean) return NextResponse.json({ error: "Donnez un nom au dossier (80 caractères au plus)." }, { status: 400 });
    if (parentId) {
      const { data: parent } = await supabase.from("vault_folder").select("id").eq("id", parentId).eq("dossier_id", dossierId).maybeSingle();
      if (!parent) return NextResponse.json({ error: "Dossier parent introuvable." }, { status: 404 });
    }
    const { data, error } = await supabase.from("vault_folder").insert({ dossier_id: dossierId, name: clean, parent_id: parentId }).select("*").single();
    if (error?.code === "23505") return NextResponse.json({ error: `Un dossier « ${clean} » existe déjà ici.` }, { status: 409 });
    if (error || !data) return NextResponse.json({ error: "Création impossible." }, { status: 500 });
    return NextResponse.json({ folder: mapFolder(data) });
  } catch (e) {
    return errorResponse(e);
  }
}
