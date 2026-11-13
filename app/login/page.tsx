"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (error) {
      setMessage({ kind: "error", text: error.message });
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) {
      setMessage({ kind: "error", text: "Entrez votre courriel d'abord." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    setMessage(
      error ? { kind: "error", text: error.message } : { kind: "info", text: "Lien envoyé — vérifiez votre courriel." },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-[18px] bg-night p-6 text-night-ink">
          <div className="flex items-baseline gap-3 font-mono font-semibold">
            <span className="text-3xl">ABJ</span>
            <span className="text-signal text-xl">→</span>
            <span className="text-3xl">YYC</span>
          </div>
          <p className="mt-2 text-sm text-night-muted">Projet Canada Calgary — suivi de l&apos;Entrée express</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <div className="mb-4 inline-flex gap-1 rounded-lg border border-line bg-surface-2 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              aria-pressed={mode === "signin"}
              className="rounded-md px-3 py-1.5 font-semibold text-muted aria-pressed:bg-act-soft aria-pressed:text-act"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              aria-pressed={mode === "signup"}
              className="rounded-md px-3 py-1.5 font-semibold text-muted aria-pressed:bg-act-soft aria-pressed:text-act"
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Courriel
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-ink focus:border-act focus:outline-none focus:ring-2 focus:ring-act-soft"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Mot de passe
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-ink focus:border-act focus:outline-none focus:ring-2 focus:ring-act-soft"
              />
            </label>

            {message && (
              <p className={message.kind === "error" ? "text-sm text-bad" : "text-sm text-ok"} role="status">
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-lg bg-act px-4 py-2 font-semibold text-act-ink disabled:opacity-60"
            >
              {mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={busy}
              className="rounded-lg bg-act-soft px-4 py-2 text-sm font-semibold text-act disabled:opacity-60"
            >
              Recevoir un lien magique par courriel
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Un seul titulaire de dossier ; la double authentification sera demandée à la première connexion.
        </p>
      </div>
    </div>
  );
}
