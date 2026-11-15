import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getVaultFiles } from "@/lib/queries";
import { VaultBoard } from "@/components/coffre/VaultBoard";
import { mapFolder } from "@/lib/folders";

export default async function CoffrePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");
  if (dossier.ownerId !== userData.user?.id) redirect("/parcours");

  const [files, { data: docs }, { data: folderRows }] = await Promise.all([
    getVaultFiles(supabase, dossier.id),
    supabase.from("document").select("id,name").eq("dossier_id", dossier.id),
    supabase.from("vault_folder").select("*").eq("dossier_id", dossier.id).order("name"),
  ]);

  const documentNames: Record<string, string> = {};
  for (const d of docs ?? []) documentNames[d.id as string] = d.name as string;

  return <VaultBoard initialFiles={files} documentNames={documentNames} initialFolders={(folderRows ?? []).map(mapFolder)} />;
}
