import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getStepsWithDetails } from "@/lib/queries";
import { budgetByPhase, isOpenStep } from "@/lib/rules";
import { BudgetBoard } from "@/components/budget/BudgetBoard";
import { getDailyRates } from "@/lib/rates";

export default async function BudgetPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [steps, rates] = await Promise.all([getStepsWithDetails(supabase, dossier.id), getDailyRates()]);
  const upcoming = steps
    .filter((s) => isOpenStep(s.status) && (s.planned ?? 0) > 0 && s.actual == null)
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .map((s) => ({ id: s.id, title: s.title, due: s.due, planned: s.planned ?? 0, phase: s.phase }));

  return <BudgetBoard dossier={dossier} rows={budgetByPhase(steps)} upcoming={upcoming} rates={rates} />;
}
