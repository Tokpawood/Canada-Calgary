"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui";
import { DarkHeader, DarkTiles } from "@/components/DarkHeader";
import { PasswordInput, authErrorFr } from "@/components/PasswordInput";
import { IconCheck, IconInfo, IconLock, IconLogout, IconShield } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import type { Account } from "@/lib/account";
import { ACCOUNT_TIME_LABEL, formatCreatedAt, formatLastSignIn } from "@/lib/compte";

const MIN = 7;

function strength(p: string): { score: number; label: string } {
  let s = 0;
  if (p.length >= MIN) s++;
  if (p.length >= 14) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const label = p.length < MIN ? "Trop court" : s <= 2 ? "Correct" : s <= 3 ? "Bon" : "Excellent";
  return { score: p.length < MIN ? Math.min(1, s) : s, label };
}

export function AccountBoard({
  email,
  account,
  lastSignIn,
  createdAt,
  children,
}: {
  email: string;
  account: Account;
  lastSignIn: string | null;
  createdAt: string | null;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Fuseau fixe : même texte au rendu serveur et sur l'appareil (pas d'erreur d'hydratation).
  const lastSeen = formatLastSignIn(lastSignIn);
  const st = strength(next);
  const rules = [
    { ok: next.length >= MIN, text: `${MIN} caractères minimum` },
    { ok: next.length > 0 && next !== current, text: "Différent du mot de passe actuel" },
    { ok: next.length > 0 && next === confirm, text: "Les deux saisies sont identiques" },
  ];
  const valid = current.length > 0 && rules.every((r) => r.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    setDone(false);

    // Vérifie le mot de passe actuel avec un client isolé, sans toucher à la session en cours.
    const probe = createIsolatedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: checkErr } = await probe.auth.signInWithPassword({ email, password: current });
    if (checkErr) {
      setBusy(false);
      setError(checkErr.message.toLowerCase().includes("invalid login") ? "Le mot de passe actuel est incorrect." : authErrorFr(checkErr.message));
      return;
    }
    await probe.auth.signOut({ scope: "local" });

    const { error: updErr } = await createClient().auth.updateUser({ password: next });
    setBusy(false);
    if (updErr) {
      setError(authErrorFr(updErr.message));
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  async function signOutEverywhere() {
    if (!window.confirm("Fermer toutes les sessions, y compris celle-ci ? Vous devrez vous reconnecter sur chaque appareil.")) return;
    setSigningOut(true);
    setSignOutError(null);
    const { error: outErr } = await createClient().auth.signOut({ scope: "global" });
    if (outErr) {
      setSigningOut(false);
      setSignOutError(authErrorFr(outErr.message));
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Compte et sécurité" description="Votre accès à l'application : identifiant, mot de passe et sessions." />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              { label: "Dernière connexion", value: lastSeen?.day ?? "—", sub: lastSeen ? `à ${lastSeen.time} (${ACCOUNT_TIME_LABEL})` : "" },
              { label: "Compte créé", value: formatCreatedAt(createdAt) ?? "—", sub: "compte unique" },
            ]}
          />
        }
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          <IconShield size={13} /> Titulaire du dossier
        </p>
        <div className="mt-3 flex items-center gap-4">
          <Avatar url={account.avatarUrl} initials={account.initials} size={64} />
          <div className="min-w-0">
            <p className="font-display text-[30px] leading-tight font-extrabold sm:text-[34px]">{account.fullName}</p>
            <p className="truncate text-[13px] text-night-muted">{email}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Connexion par courriel et mot de passe", "Création de compte désactivée", "Coffre réservé au titulaire"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[12px] font-semibold">
              <IconCheck size={13} strokeWidth={2.6} className="text-signal" />
              {t}
            </span>
          ))}
        </div>
      </DarkHeader>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-act-soft text-act">
              <IconLock size={18} />
            </span>
            <div>
              <h2 className="text-[18px] font-bold">Modifier le mot de passe</h2>
              <p className="text-[12.5px] text-muted">Saisissez votre mot de passe actuel, puis le nouveau deux fois.</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 flex max-w-[520px] flex-col gap-4">
            <label>
              <span className="field-label">Mot de passe actuel</span>
              <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
            </label>
            <label>
              <span className="field-label">Nouveau mot de passe</span>
              <PasswordInput value={next} onChange={setNext} autoComplete="new-password" minLength={MIN} />
              {next && (
                <span className="mt-2 flex items-center gap-3">
                  <span className="grid flex-1 grid-cols-5 gap-1" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1.5 rounded-full ${i < st.score ? (st.score <= 2 ? "bg-opt" : "bg-ok") : "bg-surface-2"}`} />
                    ))}
                  </span>
                  <span aria-live="polite" className={`text-[12px] font-semibold ${next.length < MIN ? "text-bad" : st.score <= 2 ? "text-opt" : "text-ok"}`}>{st.label}</span>
                </span>
              )}
            </label>
            <label>
              <span className="field-label">Confirmer le nouveau mot de passe</span>
              <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </label>

            <ul className="flex flex-col gap-1.5">
              {rules.map((r) => (
                <li key={r.text} className={`flex items-center gap-2 text-[12.5px] ${r.ok ? "text-ok" : "text-muted"}`}>
                  <span className={`grid h-4 w-4 place-items-center rounded-full ${r.ok ? "bg-ok text-surface" : "border border-line"}`}>
                    {r.ok && <IconCheck size={10} strokeWidth={3.2} />}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>

            {error && (
              <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
                {error}
              </p>
            )}
            {done && (
              <p role="status" className="flex items-center gap-2 rounded-lg bg-ok-bg px-3 py-2 text-[13px] font-semibold text-ok">
                <IconCheck size={15} strokeWidth={2.6} className="shrink-0" /> Mot de passe modifié. Utilisez-le à votre prochaine connexion, et pensez à déconnecter les autres appareils (Sessions).
              </p>
            )}

            <div>
              <button type="submit" disabled={!valid || busy} className="btn btn-primary py-2.5">
                {busy ? "Modification…" : "Enregistrer le nouveau mot de passe"}
              </button>
            </div>
          </form>
        </section>

        <div className="flex flex-col gap-5 self-start">
          <section className="card p-5">
            <h2 className="text-[15px] font-bold">Sessions</h2>
            <p className="mt-1 text-[12.5px] text-muted">Après un changement de mot de passe, déconnectez les autres appareils (iPad, ordinateur…).</p>
            <button type="button" onClick={() => void signOutEverywhere()} disabled={signingOut} className="btn btn-ghost mt-4 w-full">
              <IconLogout size={15} /> {signingOut ? "Déconnexion…" : "Se déconnecter partout"}
            </button>
            {signOutError && (
              <p role="alert" className="mt-2 rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">
                {signOutError}
              </p>
            )}
          </section>
          <aside className="rounded-2xl border border-dashed border-line p-5">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <IconInfo size={15} className="text-muted" /> Conseils
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-muted">
              <li>Préférez une phrase de passe longue à un mot compliqué.</li>
              <li>N&apos;utilisez pas ce mot de passe sur un autre site.</li>
              <li>Enregistrez-le dans le trousseau de l&apos;iPad ou un gestionnaire de mots de passe.</li>
            </ul>
          </aside>
        </div>
      </div>
      {children && <div className="mt-5 flex flex-col gap-5">{children}</div>}
    </>
  );
}
