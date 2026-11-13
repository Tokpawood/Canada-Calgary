import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getSavings } from "@/lib/queries";
import { EpargneBoard } from "@/components/epargne/EpargneBoard";

export default async function EpargnePage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const savings = await getSavings(supabase, dossier.id);
  return <EpargneBoard dossier={dossier} initialSavings={savings} />;
}
