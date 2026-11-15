import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getDossierForUser, getNetwork, getSavingsActual, getStepsWithDetails, signPhotos } from "@/lib/queries";
import { fundsProgress } from "@/lib/rules";
import { getDailyRates } from "@/lib/rates";
import { effectiveFundsMin } from "@/lib/epargne";
import type { Stat } from "@/components/StatsRow";
import { ParcoursBoard } from "@/components/parcours/ParcoursBoard";

export default async function ParcoursPage({ searchParams }: { searchParams: Promise<{ etape?: string | string[] }> }) {
  const { etape } = await searchParams;
  const supabase = await createClient();
  const stored = await getDossierForUser(supabase);
  if (!stored) redirect("/import");

  const [steps, savings, contacts, rates] = await Promise.all([getStepsWithDetails(supabase, stored.id), getSavingsActual(supabase, stored.id), getContacts(supabase, stored.id), getDailyRates()]);
  const dossier = { ...stored, fundsMin: effectiveFundsMin(stored, rates?.perXof.CAD) };
  const { persons, links } = await getNetwork(supabase, dossier.id);
  const logos = await signPhotos(
    supabase,
    contacts.map((c) => c.photoPath),
  );
  const withLogos = contacts.map((c) => ({ ...c, photoUrl: c.photoPath ? (logos.get(c.photoPath) ?? null) : null }));
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
      dossierId={dossier.id}
      initialSteps={steps}
      fundsStat={fundsStat}
      profileDate={dossier.profileDate}
      network={{ contacts: withLogos, persons, links }}
      initialOpen={typeof etape === "string" ? etape : null}
    />
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}
