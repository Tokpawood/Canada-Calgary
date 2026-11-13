import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getStepsWithDetails } from "@/lib/queries";
import { budgetByPhase } from "@/lib/rules";
import { BudgetBoard } from "@/components/budget/BudgetBoard";

export default async function BudgetPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const steps = await getStepsWithDetails(supabase, dossier.id);
  return <BudgetBoard dossier={dossier} rows={budgetByPhase(steps)} />;
}
