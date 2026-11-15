import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysUntil, isOpenStep } from "@/lib/rules";
import { sendReminderEmail } from "@/lib/email";
import type { Step, StepStatus } from "@/lib/types";
import { expiringDocs, type ExpiringDoc } from "@/lib/documents";

type DocRow = { name: string; expires: string | null };

type StepRow = Pick<Step, "id" | "title" | "due" | "status">;

const THRESHOLDS: Array<["J-7" | "J-1", number]> = [
  ["J-7", 7],
  ["J-1", 1],
];

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const header = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${expected ?? ""}`);
  // Comparaison à temps constant : la durée de la réponse ne renseigne pas sur le secret.
  if (!expected || header.length !== wanted.length || !timingSafeEqual(header, wanted)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: dossiers } = await supabase.from("dossier").select("id");
  const isMonday = new Date().getDay() === 1;
  const results: Array<{ dossierId: string; sent: number; digestSent: boolean }> = [];

  for (const d of dossiers ?? []) {
    const dossierId = d.id as string;
    const [{ data: stepsRaw }, { data: docsRaw }, { data: profile }] = await Promise.all([
      supabase.from("step").select("id,title,due,status").eq("dossier_id", dossierId),
      supabase.from("document").select("name,expires").eq("dossier_id", dossierId).not("expires", "is", null),
      supabase.from("profile").select("courriel").eq("dossier_id", dossierId).maybeSingle(),
    ]);
    const to = profile?.courriel as string | undefined;
    if (!to) continue;

    const steps: StepRow[] = (stepsRaw ?? []).map((s) => ({ id: s.id as string, title: s.title as string, due: s.due as string | null, status: s.status as StepStatus }));
    let sent = 0;

    for (const s of steps) {
      if (!isOpenStep(s.status)) continue;
      const d = daysUntil(s.due);
      for (const [kind, threshold] of THRESHOLDS) {
        if (d !== threshold) continue;
        const { data: already } = await supabase.from("reminder_log").select("id").eq("step_id", s.id).eq("kind", kind).maybeSingle();
        if (already) continue;

        const result = await sendReminderEmail(
          to,
          `Échéance ${kind} : ${s.title}`,
          `<p>L'étape « ${esc(s.title)} » arrive à échéance le ${esc(s.due ?? "")}.</p>`,
        );
        if (result.sent) {
          await supabase.from("reminder_log").insert({ step_id: s.id, kind });
          sent++;
        }
      }
    }

    let digestSent = false;
    if (isMonday) {
      const late = steps.filter((s) => isOpenStep(s.status) && (daysUntil(s.due) ?? 1) < 0);
      const upcoming = steps.filter((s) => isOpenStep(s.status) && inNext7Days(daysUntil(s.due)));
      const expiring = expiringDocs((docsRaw ?? []) as DocRow[]);
      if (late.length || upcoming.length || expiring.length) {
        const result = await sendReminderEmail(to, "Résumé hebdomadaire — Projet Canada Calgary", renderDigest(late, upcoming, expiring));
        digestSent = result.sent;
      }
    }

    results.push({ dossierId, sent, digestSent });
  }

  return NextResponse.json({ ok: true, results });
}

function inNext7Days(d: number | null): boolean {
  return d !== null && d >= 0 && d <= 7;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderDigest(late: StepRow[], upcoming: StepRow[], expiring: ExpiringDoc<DocRow>[]): string {
  const item = (s: StepRow) => `<li>${esc(s.title)} — ${esc(s.due ?? "sans échéance")}</li>`;
  const docItem = (e: ExpiringDoc<DocRow>) =>
    `<li>${esc(e.doc.name)} — ${e.state === "expired" ? "expirée depuis le" : "valable jusqu'au"} ${esc(e.doc.expires ?? "")}</li>`;
  return `
    <h2>Résumé de la semaine</h2>
    ${late.length ? `<p><strong>En retard (${late.length})</strong></p><ul>${late.map(item).join("")}</ul>` : ""}
    ${upcoming.length ? `<p><strong>À venir dans les 7 jours (${upcoming.length})</strong></p><ul>${upcoming.map(item).join("")}</ul>` : ""}
    ${expiring.length ? `<p><strong>Pièces à renouveler (${expiring.length})</strong></p><ul>${expiring.map(docItem).join("")}</ul>` : ""}
  `;
}
