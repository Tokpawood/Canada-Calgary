"use client";

import { useEffect, useState } from "react";
import { IconCalendar, IconRefresh } from "@/components/icons";

export interface CalendarCardStatus {
  enabled: boolean;
  lastSync: string | null;
  lastError: string | null;
  count: number;
  pending: number;
}

const NOTICES: Record<string, string> = {
  refuse: "L'accès au calendrier n'a pas été accordé. Recommencez en cochant l'autorisation du calendrier.",
  erreur: "La connexion du calendrier a échoué : recommencez.",
};

/** Carte « Google Calendar » : tâches et échéances envoyées dans un calendrier à part. */
export function CalendarCard({ initial, configured, connected, notice }: { initial: CalendarCardStatus; configured: boolean; connected: boolean; notice: string | null }) {
  const [st, setSt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(notice ? (NOTICES[notice] ?? null) : null);
  const on = st.enabled && connected;

  // Suit l'avancement du premier envoi.
  const watching = on && !st.lastError && (!st.lastSync || st.pending > 0 || busy);
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(async () => {
      const res = await fetch("/api/calendar", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const next = (await res.json()) as CalendarCardStatus;
      setSt(next);
      if (next.lastError || next.lastSync !== st.lastSync) setBusy(false);
    }, 5000);
    return () => clearInterval(id);
  }, [watching, st.lastSync]);

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/calendar", { method }).catch(() => null);
    if (!res?.ok) {
      const json = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setMessage(json?.error ?? "Action impossible : vérifiez la connexion.");
      setBusy(false);
      return;
    }
    if (method === "DELETE") {
      setSt({ ...st, enabled: false });
      setBusy(false);
    } else setSt({ ...st, lastError: null });
  }

  return (
    <section id="calendrier" className="card scroll-mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">Google Calendar</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Formation, tests, envois, étapes du Parcours et expirations de pièces, dans un calendrier « Projet Canada Calgary » à part. Mis à jour
            tout seul, en général en 5 minutes. Les changements faits dans Google ne reviennent pas ici.
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${on ? "bg-ok-bg text-ok" : "bg-surface-2 text-muted"}`}>{on ? "Synchronisé" : "Désactivé"}</span>
      </div>

      {on && (
        <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
          <span className="mono font-semibold">{st.count}</span> événements
          {st.pending > 0 ? ` · ${st.pending} en attente` : ""}
          {st.lastSync
            ? ` · dernier envoi le ${new Date(st.lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}`
            : " · premier envoi en cours, comptez quelques minutes"}
        </p>
      )}
      {(message || (on && st.lastError)) && (
        <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad" role="status">
          {message ?? st.lastError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {configured && (
          // Navigation complète : le serveur redirige vers l'écran de consentement Google.
          <a href="/api/drive/connect?calendar=1" className={on ? "btn" : "btn btn-primary"}>
            <IconCalendar size={15} /> {on ? "Reconnecter" : "Connecter le calendrier"}
          </a>
        )}
        {on && (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => send("POST")}>
              <IconRefresh size={15} /> {busy ? "Synchronisation…" : "Synchroniser maintenant"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => send("DELETE")}>
              Arrêter
            </button>
          </>
        )}
      </div>
    </section>
  );
}
