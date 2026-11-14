"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlert, IconCheck, IconUpload } from "@/components/icons";

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  folderUrl: string | null;
  pendingMigration: number;
  notice: string | null;
}

const NOTICES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  connecte: { tone: "ok", text: "Google Drive est connecté. Les prochains fichiers y seront enregistrés." },
  refuse: { tone: "bad", text: "Connexion annulée : l'accès à Google Drive n'a pas été accordé." },
  "etat-invalide": { tone: "bad", text: "La connexion a expiré ou a été interrompue : recommencez." },
  erreur: { tone: "bad", text: "La connexion à Google Drive a échoué : recommencez." },
  "non-configure": { tone: "bad", text: "Google Drive n'est pas encore configuré sur ce serveur (identifiants Google manquants)." },
};

/** Carte « Google Drive » : où sont stockés les fichiers déposés. */
export function DriveCard({ status }: { status: DriveStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"migrate" | "disconnect" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(status.notice ? (NOTICES[status.notice] ?? null) : null);
  const [confirmOff, setConfirmOff] = useState(false);

  async function migrate() {
    setBusy("migrate");
    setMessage(null);
    const res = await fetch("/api/drive/migrate", { method: "POST" }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { moved?: number; failed?: string[]; error?: string } | undefined;
    setBusy(null);
    if (!res?.ok) return setMessage({ tone: "bad", text: json?.error ?? "Transfert impossible." });
    const failed = json?.failed ?? [];
    setMessage(
      failed.length
        ? { tone: "bad", text: `${json?.moved ?? 0} fichier(s) transféré(s), ${failed.length} en échec : ${failed.join(", ")}.` }
        : { tone: "ok", text: `${json?.moved ?? 0} fichier(s) transféré(s) vers Google Drive.` },
    );
    router.refresh();
  }

  async function disconnect() {
    setBusy("disconnect");
    await fetch("/api/drive/disconnect", { method: "POST" }).catch(() => null);
    setBusy(null);
    setConfirmOff(false);
    setMessage({ tone: "ok", text: "Google Drive est déconnecté. Vos fichiers restent sur Drive ; reconnectez-le pour les afficher." });
    router.refresh();
  }

  return (
    <section id="drive" className="card scroll-mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">Google Drive</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Tous les fichiers déposés (Coffre et scans des documents) sont enregistrés dans votre Google Drive.</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            status.connected ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"
          }`}
        >
          {status.connected ? <IconCheck size={13} strokeWidth={2.6} /> : <IconAlert size={13} />}
          {status.connected ? "Connecté" : "Non connecté"}
        </span>
      </div>

      {status.connected ? (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="text-[11.5px] text-muted">Compte Google</dt>
            <dd className="m-0 truncate text-[13.5px] font-semibold">{status.accountEmail ?? "—"}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="text-[11.5px] text-muted">Dossier</dt>
            <dd className="m-0 text-[13.5px] font-semibold">
              {status.folderUrl ? (
                <a href={status.folderUrl} target="_blank" rel="noopener noreferrer" className="text-act underline-offset-2 hover:underline">
                  Projet Canada Calgary ↗
                </a>
              ) : (
                "Projet Canada Calgary"
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
          Tant que Google Drive n&apos;est pas connecté, <strong>aucun fichier ne peut être déposé</strong>.
        </p>
      )}

      {status.connected && status.pendingMigration > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line px-3 py-2.5">
          <p className="text-[13px]">
            <span className="mono font-semibold">{status.pendingMigration}</span> fichier(s) encore dans l&apos;ancien stockage de l&apos;application.
          </p>
          <button type="button" onClick={migrate} disabled={busy !== null} className="btn btn-primary">
            <IconUpload size={15} /> {busy === "migrate" ? "Transfert…" : "Transférer vers Drive"}
          </button>
        </div>
      )}

      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${message.tone === "ok" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`} role="status">
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status.configured ? (
          // Navigation complète : le serveur redirige vers l'écran de consentement Google.
          <a href="/api/drive/connect" className={status.connected ? "btn" : "btn btn-primary"}>
            {status.connected ? "Reconnecter" : "Connecter Google Drive"}
          </a>
        ) : (
          <p className="text-[12.5px] text-muted">Identifiants Google à renseigner dans <span className="mono">.env.local</span> (voir le guide).</p>
        )}
        {status.connected &&
          (confirmOff ? (
            <>
              <button type="button" onClick={disconnect} disabled={busy !== null} className="btn text-bad">
                {busy === "disconnect" ? "Déconnexion…" : "Confirmer la déconnexion"}
              </button>
              <button type="button" onClick={() => setConfirmOff(false)} className="btn">
                Annuler
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmOff(true)} className="btn">
              Déconnecter
            </button>
          ))}
      </div>
      <p className="mt-3 text-[11.5px] text-faint">
        Accès limité : l&apos;application ne voit que les fichiers qu&apos;elle a elle-même créés dans votre Drive. Une suppression envoie le fichier dans la corbeille Drive (récupérable 30 jours).
      </p>
    </section>
  );
}
