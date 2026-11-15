import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOpenStep } from "@/lib/rules";
import { DEFAULT_SETTINGS, cleanTimes, type NotifySettings, type StepLite } from "@/lib/notifyPlan";
import type { StepStatus } from "@/lib/types";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  // Le « sujet » VAPID est l'adresse du site (pas de courriel transmis aux services push).
  webpush.setVapidDetails(process.env.PUSH_SUBJECT || "https://canada-calgary.vercel.app", pub, priv);
  configured = true;
  return true;
}

/** Envoie à tous les appareils du dossier ; supprime les abonnements expirés. Renvoie le nombre d'envois réussis. */
export async function sendToDossier(dossierId: string, payload: PushPayload, admin: SupabaseClient = createAdminClient()): Promise<{ sent: number; devices: number }> {
  if (!configure()) throw new Error("Clés VAPID absentes");
  const { data: subs } = await admin.from("push_subscription").select("id,endpoint,p256dh,auth").eq("dossier_id", dossierId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
      sent++;
      await admin.from("push_subscription").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscription").delete().eq("id", s.id);
      else console.error("push", code ?? e);
    }
  }
  return { sent, devices: subs?.length ?? 0 };
}

export async function loadSettings(admin: SupabaseClient, dossierId: string): Promise<NotifySettings> {
  const { data } = await admin.from("notification_settings").select("enabled,times,include_steps").eq("dossier_id", dossierId).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { enabled: Boolean(data.enabled), times: cleanTimes(data.times), includeSteps: Boolean(data.include_steps) };
}

export async function loadStepsLite(admin: SupabaseClient, dossierId: string): Promise<StepLite[]> {
  const { data } = await admin.from("step").select("title,due,status").eq("dossier_id", dossierId);
  return (data ?? []).map((s) => ({ title: s.title as string, due: (s.due as string | null) ?? null, open: isOpenStep(s.status as StepStatus) }));
}
