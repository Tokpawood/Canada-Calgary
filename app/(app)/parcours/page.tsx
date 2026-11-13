import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getSavingsActual, getStepsWithDetails } from "@/lib/queries";
import { daysUntil, fundsProgress, nextOpenStep, overallProgress, parseD, phaseProgress } from "@/lib/rules";
import { Hero } from "@/components/Hero";
import { StatsRow, type Stat } from "@/components/StatsRow";
import { ParcoursBoard } from "@/components/parcours/ParcoursBoard";

export default async function ParcoursPage() {
  const supabase = await createClient();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [steps, savings] = await Promise.all([getStepsWithDetails(supabase, dossier.id), getSavingsActual(supabase, dossier.id)]);

  const overallPct = Math.round(overallProgress(steps) * 100);
  const next = nextOpenStep(steps);
  const funds = fundsProgress(savings, dossier);
  const done = steps.filter((s) => s.status === "Fait").length;
  const counted = steps.filter((s) => s.status !== "Si nécessaire").length;
  const totalPlanned = steps.reduce((sum, s) => sum + (s.planned ?? 0), 0);
  const totalActual = steps.reduce((sum, s) => sum + (s.actual ?? 0), 0);
  const countdown = daysUntil(dossier.profileDate);
  const profileDate = parseD(dossier.profileDate);

  const stats: Stat[] = [
    { label: "Étapes faites", value: `${done}`, unit: `/ ${counted}`, sub: `${steps.length - counted} étape(s) facultative(s)`, pct: counted ? (done / counted) * 100 : 0 },
    {
      label: "Fonds d'installation",
      value: `${Math.round(funds.pctOfTarget)} %`,
      sub: `${fmt(funds.saved)} F sur ${fmt(dossier.fundsTarget)} F`,
      pct: funds.pctOfTarget,
      markerPct: funds.minMarkPct,
      markerLabel: `Minimum exigé : ${fmt(dossier.fundsMin)} F`,
      tone: funds.minReached ? "ok" : "act",
    },
    {
      label: "Dépenses payées",
      value: fmt(totalActual),
      unit: "F",
      sub: totalPlanned > 0 ? `sur ${fmt(totalPlanned)} F prévus` : "aucun montant prévu",
      pct: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
    },
    {
      label: "Création du profil",
      value: countdown == null ? "—" : countdown >= 0 ? `J-${countdown}` : `+${-countdown} j`,
      sub: profileDate ? profileDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "date non définie",
    },
  ];

  return (
    <>
      <Hero phases={phaseProgress(steps)} overallPct={overallPct} nextStep={next ? { title: next.title, due: next.due, daysLeft: daysUntil(next.due) } : null} />
      <StatsRow stats={stats} />
      <ParcoursBoard initialSteps={steps} />
    </>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}
