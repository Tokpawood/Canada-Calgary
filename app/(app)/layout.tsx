import { expiringDocs } from "@/lib/documents";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser, getStepsWithDetails } from "@/lib/queries";
import { daysUntil, isLate, nextOpenStep, overallProgress, parseD } from "@/lib/rules";
import { DossierProvider } from "@/lib/dossier-context";
import { AppShell, type ShellSummary } from "@/components/AppShell";
import { getAccount } from "@/lib/account";
import { dayPlan } from "@/lib/formation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const dossier = await getDossierForUser(supabase);

  let summary: ShellSummary | null = null;
  if (dossier) {
    // Actions de Formation prévues aujourd'hui (fuseau d'Abidjan), pour la pastille de la barre latérale.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
    const todayKeys = dayPlan(today)?.items.map((i) => i.key) ?? [];
    const [steps, { data: docRows }, { data: checkRows }] = await Promise.all([
      getStepsWithDetails(supabase, dossier.id),
      supabase.from("document").select("status,expires").eq("dossier_id", dossier.id),
      todayKeys.length
        ? supabase.from("training_check").select("item_key").eq("dossier_id", dossier.id).in("item_key", todayKeys)
        : Promise.resolve({ data: [] as Array<{ item_key: string }> }),
    ]);
    const checked = new Set((checkRows ?? []).map((c) => c.item_key as string));
    const next = nextOpenStep(steps);
    const nextDays = daysUntil(next?.due);
    const countdown = daysUntil(dossier.profileDate);

    summary = {
      overallPct: Math.round(overallProgress(steps) * 100),
      nextStep: next
        ? {
            title: next.title,
            dueLabel: next.due ? `${fmtDate(next.due)}${nextDays != null ? ` · ${relative(nextDays)}` : ""}` : null,
            late: nextDays != null && nextDays < 0,
          }
        : null,
      countdown:
        countdown == null
          ? null
          : { label: countdown >= 0 ? `J-${countdown}` : `+${-countdown} j`, date: dossier.profileDate, late: countdown < 0 },
      lateSteps: steps.filter((s) => isLate(s)).length,
      formationToday: { remaining: todayKeys.filter((k) => !checked.has(k)).length, total: todayKeys.length },
      docs: {
        obtained: (docRows ?? []).filter((d) => d.status === "Obtenu").length,
        total: (docRows ?? []).length,
        expired: expiringDocs((docRows ?? []).map((d) => ({ expires: (d.expires as string | null) ?? null })), new Date(), -1).filter((e) => e.state === "expired").length,
      },
    };
  }

  const account = await getAccount(supabase, userData.user, dossier?.id ?? null);

  return (
    <DossierProvider dossierId={dossier?.id ?? null}>
      <AppShell summary={summary} isOwner={!dossier || dossier.ownerId === userData.user.id} account={account}>
        {children}
      </AppShell>
    </DossierProvider>
  );
}

function fmtDate(iso: string): string {
  const d = parseD(iso);
  return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : iso;
}

function relative(days: number): string {
  if (days < 0) return `en retard de ${-days} j`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} j`;
}
