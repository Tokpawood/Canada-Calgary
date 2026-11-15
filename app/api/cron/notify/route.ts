import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { abidjanNow, dueNow, remindersFor } from "@/lib/notifyPlan";
import { loadDocsLite, loadSettings, loadStepsLite, sendToDossier } from "@/lib/push";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFY_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Appelée toutes les 5 minutes par pg_cron : envoie les rappels dont l'heure est atteinte
 * (fenêtre de 30 minutes), une seule fois chacun grâce à notification_log.
 * `?at=HH:MM&date=AAAA-MM-JJ` simule un autre instant (essais).
 */
async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const admin = createAdminClient();
  const now = abidjanNow();
  const q = request.nextUrl.searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : now.date;
  const time = /^\d{2}:\d{2}$/.test(q.get("at") ?? "") ? q.get("at")! : now.time;

  const { data: subs } = await admin.from("push_subscription").select("dossier_id");
  const dossiers = [...new Set((subs ?? []).map((s) => s.dossier_id as string))];
  const results: Array<{ key: string; sent: number }> = [];

  for (const dossierId of dossiers) {
    const settings = await loadSettings(admin, dossierId);
    if (!settings.enabled) continue;
    const [{ data: checks }, steps, docs] = await Promise.all([
      admin.from("training_check").select("item_key").eq("dossier_id", dossierId).like("item_key", `${date}:%`),
      loadStepsLite(admin, dossierId),
      loadDocsLite(admin, dossierId),
    ]);
    const done = new Set((checks ?? []).map((c) => c.item_key as string));
    // Les jalons (achat, inscription…) ont une clé de semaine : on les charge à part.
    const { data: sendChecks } = await admin.from("training_check").select("item_key").eq("dossier_id", dossierId).not("item_key", "like", "____-__-__:%");
    (sendChecks ?? []).forEach((c) => done.add(c.item_key as string));

    for (const r of dueNow(remindersFor(date, done, settings, steps, docs), time)) {
      // Réserver la clé d'abord : deux appels simultanés ne peuvent pas envoyer deux fois.
      const { error } = await admin.from("notification_log").insert({ dossier_id: dossierId, key: r.key });
      if (error) continue;
      const { sent, devices } = await sendToDossier(dossierId, { title: r.title, body: r.body, url: r.url, tag: r.tag }, admin);
      // Aucun appareil joint (panne passagère) : on libère la clé pour réessayer au prochain passage.
      if (!sent && devices) await admin.from("notification_log").delete().eq("dossier_id", dossierId).eq("key", r.key);
      results.push({ key: r.key, sent });
    }
  }

  // Purge du journal au-delà de 30 jours.
  await admin.from("notification_log").delete().lt("sent_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  return NextResponse.json({ ok: true, date, time, results });
}

export const GET = run;
export const POST = run;
