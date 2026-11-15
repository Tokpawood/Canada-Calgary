"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconAlert, IconCheck, IconInfo } from "@/components/icons";
import { HHMM, MOMENTS, type NotifySettings } from "@/lib/notifyPlan";

type Support = "checking" | "ok" | "ios-browser" | "unsupported" | "denied";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Carte « Notifications » : rappels push des tâches de la formation sur cet appareil. */
export function NotificationsCard({ dossierId, initial, devices }: { dossierId: string; initial: NotifySettings; devices: number }) {
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [settings, setSettings] = useState(initial);
  const [deviceCount, setDeviceCount] = useState(devices);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    void (async () => {
      const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!hasPush) return setSupport(ios && !standalone ? "ios-browser" : "unsupported");
      if (Notification.permission === "denied") return setSupport("denied");
      setSupport("ok");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    })();
  }, []);

  async function enable() {
    if (!vapid) return setMessage({ tone: "bad", text: "Les notifications ne sont pas encore configurées sur ce serveur." });
    setBusy("enable");
    setMessage(null);
    try {
      // La demande d'autorisation doit partir d'un geste (toucher le bouton), sinon iOS la refuse.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setSupport(perm === "denied" ? "denied" : "ok");
        throw new Error("Autorisation refusée.");
      }
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapid) }));
      const res = await fetch("/api/notifications/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Enregistrement impossible.");
      setSubscribed(true);
      setDeviceCount((n) => n + 1);
      if (!settings.enabled) await save({ ...settings, enabled: true });
      setMessage({ tone: "ok", text: "Cet appareil recevra les rappels. Envoyez une notification d'essai pour vérifier." });
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Activation impossible." });
    }
    setBusy(null);
  }

  async function disable() {
    setBusy("disable");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/notifications/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => null);
      await sub.unsubscribe().catch(() => false);
    }
    setSubscribed(false);
    setDeviceCount((n) => Math.max(0, n - 1));
    setBusy(null);
    setMessage({ tone: "ok", text: "Cet appareil ne recevra plus de rappels." });
  }

  async function test() {
    setBusy("test");
    setMessage(null);
    const res = await fetch("/api/notifications/test", { method: "POST" }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { sent?: number; error?: string } | undefined;
    setBusy(null);
    if (!res?.ok) return setMessage({ tone: "bad", text: json?.error ?? "Envoi impossible." });
    setMessage(json?.sent ? { tone: "ok", text: `Notification envoyée à ${json.sent} appareil${json.sent > 1 ? "s" : ""}.` } : { tone: "bad", text: "Aucun appareil abonné n'a pu être joint." });
  }

  // Enregistrements enchaînés : deux réglages rapides arrivent dans l'ordre.
  const queue = useRef<Promise<void>>(Promise.resolve());
  function save(next: NotifySettings): Promise<void> {
    setSettings(next);
    queue.current = queue.current.then(async () => {
      const { error } = await createClient()
        .from("notification_settings")
        .upsert({ dossier_id: dossierId, enabled: next.enabled, times: next.times, include_steps: next.includeSteps, updated_at: new Date().toISOString() }, { onConflict: "dossier_id" });
      if (error) setMessage({ tone: "bad", text: "Réglage non enregistré. Vérifiez la connexion." });
    });
    return queue.current;
  }

  function setTime(id: (typeof MOMENTS)[number]["id"], v: string) {
    if (!HHMM.test(v)) return;
    const def = MOMENTS.find((m) => m.id === id)!.time;
    const times = { ...settings.times };
    if (v === def) delete times[id];
    else times[id] = v;
    void save({ ...settings, times });
  }

  return (
    <section id="notifications" className="card scroll-mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">Notifications</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Un rappel à chaque moment de la journée pour les tâches de la formation, avec un lien direct vers la tâche à valider.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${subscribed ? "bg-ok-bg text-ok" : "bg-surface-2 text-muted"}`}>
          {subscribed ? <IconCheck size={13} strokeWidth={2.6} /> : <IconAlert size={13} />}
          {subscribed ? "Actives sur cet appareil" : "Inactives sur cet appareil"}
        </span>
      </div>

      {support === "ios-browser" && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-opt-bg px-3 py-2.5 text-[13px] text-opt">
          <IconInfo size={15} className="mt-px shrink-0" />
          Sur iPad et iPhone, ouvrez l&apos;application depuis l&apos;écran d&apos;accueil (Partager, puis « Sur l&apos;écran d&apos;accueil ») : Safari n&apos;envoie les notifications qu&apos;à l&apos;application installée (iOS 16.4 ou plus récent).
        </p>
      )}
      {support === "unsupported" && <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-muted">Ce navigateur ne prend pas en charge les notifications push.</p>}
      {support === "denied" && (
        <p className="mt-4 rounded-xl bg-bad-bg px-3 py-2.5 text-[13px] text-bad">
          Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages de l&apos;appareil (Réglages, Notifications, Projet Canada Calgary), puis revenez ici.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {support === "ok" &&
          (subscribed ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={test} disabled={busy !== null}>
                {busy === "test" ? "Envoi…" : "Envoyer une notification d'essai"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={disable} disabled={busy !== null}>
                Désactiver sur cet appareil
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={enable} disabled={busy !== null}>
              {busy === "enable" ? "Activation…" : "Activer les notifications"}
            </button>
          ))}
        <span className="text-[12px] text-muted">
          {deviceCount} appareil{deviceCount > 1 ? "s" : ""} abonné{deviceCount > 1 ? "s" : ""}
        </span>
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${message.tone === "ok" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] font-bold">Horaires des rappels</p>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-ok)]" checked={settings.enabled} onChange={(e) => void save({ ...settings, enabled: e.target.checked })} />
            Rappels activés
          </label>
        </div>
        <p className="mt-0.5 text-[12px] text-muted">Heure d&apos;Abidjan. Un rappel n&apos;est pas envoyé si toutes ses tâches sont déjà validées. Le samedi et le dimanche suivent les horaires du programme.</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MOMENTS.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{m.label}</span>
                <span className="block truncate text-[11.5px] text-muted">{m.hint}</span>
              </span>
              <input
                type="time"
                className="input mono h-9 w-[108px] text-[13px]"
                aria-label={`Heure : ${m.label}`}
                value={settings.times[m.id] ?? m.time}
                disabled={!settings.enabled}
                onChange={(e) => setTime(m.id, e.target.value)}
              />
            </li>
          ))}
        </ul>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-ok)]" checked={settings.includeSteps} onChange={(e) => void save({ ...settings, includeSteps: e.target.checked })} />
          Inclure dans le résumé du matin les étapes du parcours à échéance ou en retard
        </label>
      </div>
    </section>
  );
}
