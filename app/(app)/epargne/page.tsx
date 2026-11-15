import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getSavings } from "@/lib/queries";
import { EpargneBoard } from "@/components/epargne/EpargneBoard";
import { getDailyRates } from "@/lib/rates";

export default async function EpargnePage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [savings, rates] = await Promise.all([getSavings(supabase, dossier.id), getDailyRates()]);
  return <EpargneBoard dossier={dossier} initialSavings={savings} rates={rates} />;
}
