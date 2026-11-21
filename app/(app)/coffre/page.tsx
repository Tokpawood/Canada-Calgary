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
    supabase.from("document").select("id,name,position").eq("dossier_id", dossier.id).order("position"),
    supabase.from("vault_folder").select("*").eq("dossier_id", dossier.id).order("name"),
  ]);

  const documents = (docs ?? []).map((d) => ({ id: d.id as string, name: (d.name as string) || "Document" }));

  return <VaultBoard initialFiles={files} documents={documents} initialFolders={(folderRows ?? []).map(mapFolder)} />;
}
