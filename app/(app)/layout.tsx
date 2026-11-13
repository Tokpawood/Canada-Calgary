import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getSavingsActual, getStepsWithDetails } from "@/lib/queries";
import { daysUntil, fundsProgress, nextOpenStep, overallProgress, phaseProgress } from "@/lib/rules";
import { DossierProvider } from "@/lib/dossier-context";
import { SignOutButton } from "@/components/SignOutButton";
import { Hero } from "@/components/Hero";
import { StatsRow, type Stat } from "@/components/StatsRow";
import { TabsNav } from "@/components/TabsNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const dossier = await getDossierForUser(supabase);

  return (
    <DossierProvider dossierId={dossier?.id ?? null}>
      <div className="min-h-screen bg-bg">
        <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
          <Link href="/parcours" className="font-display text-lg font-bold">
            Projet Canada Calgary
          </Link>
          <SignOutButton />
        </header>
        <main className="mx-auto max-w-[1200px] px-5 pb-16">
          {dossier && <DossierChrome dossier={dossier} />}
          {children}
        </main>
      </div>
    </DossierProvider>
  );
}

async function DossierChrome({ dossier }: { dossier: NonNullable<Awaited<ReturnType<typeof getDossierForUser>>> }) {
  const supabase = await createClient();
  const [steps, savings] = await Promise.all([getStepsWithDetails(supabase, dossier.id), getSavingsActual(supabase, dossier.id)]);

  const overallPct = Math.round(overallProgress(steps) * 100);
  const next = nextOpenStep(steps);
  const funds = fundsProgress(savings, dossier);

  const totalPlanned = steps.reduce((sum, s) => sum + (s.planned ?? 0), 0);
  const totalActual = steps.reduce((sum, s) => sum + (s.actual ?? 0), 0);
  const expensesPct = totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0;

  const countdown = daysUntil(dossier.profileDate);

  const stats: Stat[] = [
    {
      label: "Étapes faites",
      value: `${steps.filter((s) => s.status === "Fait").length}/${steps.length}`,
      pct: overallPct,
    },
    {
      label: "Fonds d'installation",
      value: `${Math.round(funds.pctOfTarget)}%`,
      sub: `${formatFcfa(funds.saved)} F sur ${formatFcfa(dossier.fundsTarget)} F cible`,
      pct: funds.pctOfTarget,
      markerPct: funds.minMarkPct,
    },
    {
      label: "Dépenses payées",
      value: `${formatFcfa(totalActual)} F`,
      sub: totalPlanned > 0 ? `sur ${formatFcfa(totalPlanned)} F prévus` : "aucun montant prévu",
      pct: expensesPct,
    },
    {
      label: "Avant la création du profil",
      value: countdown == null ? "—" : countdown >= 0 ? `${countdown} j` : `${Math.abs(countdown)} j de retard`,
      sub: dossier.profileDate ?? "date non définie",
    },
  ];

  return (
    <div className="pt-5">
      <Hero
        phases={phaseProgress(steps)}
        overallPct={overallPct}
        nextStep={next ? { title: next.title, due: next.due, late: daysUntilIsLate(next.due) } : null}
      />
      <StatsRow stats={stats} />
      <TabsNav />
    </div>
  );
}

function daysUntilIsLate(due: string | null): boolean {
  const d = daysUntil(due);
  return d !== null && d < 0;
}

function formatFcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}
