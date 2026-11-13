import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getStepsWithDetails } from "@/lib/queries";
import { ParcoursBoard } from "@/components/parcours/ParcoursBoard";

export default async function ParcoursPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const steps = await getStepsWithDetails(supabase, dossier.id);

  return <ParcoursBoard initialSteps={steps} />;
}
