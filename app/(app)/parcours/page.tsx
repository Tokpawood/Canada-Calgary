import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getDossierForUser, getNetwork, getSavingsActual, getStepsWithDetails } from "@/lib/queries";
import { fundsProgress } from "@/lib/rules";
import type { Stat } from "@/components/StatsRow";
import { ParcoursBoard } from "@/components/parcours/ParcoursBoard";

export default async function ParcoursPage({ searchParams }: { searchParams: Promise<{ etape?: string | string[] }> }) {
  const { etape } = await searchParams;
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [steps, savings, contacts] = await Promise.all([getStepsWithDetails(supabase, dossier.id), getSavingsActual(supabase, dossier.id), getContacts(supabase, dossier.id)]);
  const { persons, links } = await getNetwork(
    supabase,
    contacts.map((c) => c.id),
  );
  const funds = fundsProgress(savings, dossier);

  const fundsStat: Stat = {
    label: "Fonds d'installation",
    value: `${Math.round(funds.pctOfTarget)} %`,
    sub: `${fmt(funds.saved)} F sur ${fmt(dossier.fundsTarget)} F`,
    pct: funds.pctOfTarget,
    markerPct: funds.minMarkPct,
    markerLabel: `Minimum exigé : ${fmt(dossier.fundsMin)} F`,
    tone: funds.minReached ? "ok" : "act",
  };

  return (
    <ParcoursBoard
      initialSteps={steps}
      fundsStat={fundsStat}
      profileDate={dossier.profileDate}
      network={{ contacts, persons, links }}
      initialOpen={typeof etape === "string" ? etape : null}
    />
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}
