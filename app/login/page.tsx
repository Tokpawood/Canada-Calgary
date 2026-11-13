"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFrame } from "@/components/AuthFrame";
import { IconMail, IconShield } from "@/components/icons";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    const { error } =
      mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });

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
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } });
    setBusy(false);
    setMessage(error ? { kind: "error", text: error.message } : { kind: "info", text: "Lien envoyé — vérifiez votre courriel." });
  }

  return (
    <AuthFrame>
      <h2 className="text-[26px] font-bold">{mode === "signin" ? "Bon retour" : "Créer le compte titulaire"}</h2>
      <p className="mt-1 text-[14px] text-muted">
        {mode === "signin" ? "Connectez-vous pour reprendre le suivi de votre dossier." : "Un seul titulaire par dossier : ce compte aura seul accès à l'identité et au coffre."}
      </p>

      <div role="tablist" aria-label="Mode" className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 text-[13.5px]">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2 font-semibold transition-colors ${mode === m ? "bg-act text-act-ink" : "text-muted hover:text-ink"}`}
          >
            {m === "signin" ? "Se connecter" : "Créer un compte"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <label>
          <span className="field-label">Courriel</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input py-2.5" />
        </label>
        <label>
          <span className="flex items-baseline justify-between">
            <span className="field-label">Mot de passe</span>
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-[12px] font-semibold text-act">
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </span>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={mode === "signup" ? 10 : 6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input py-2.5"
          />
          {mode === "signup" && <span className="mt-1 block text-[11.5px] text-faint">10 caractères minimum.</span>}
        </label>

        {message && (
          <p role="status" className={`rounded-lg px-3 py-2 text-[13px] ${message.kind === "error" ? "bg-bad-bg text-bad" : "bg-ok-bg text-ok"}`}>
            {message.text}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary py-2.5 text-[15px]">
          {busy ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </button>

        {mode === "signin" && (
          <>
            <div className="flex items-center gap-3 text-[12px] text-faint">
              <span className="h-px flex-1 bg-line" />
              ou
              <span className="h-px flex-1 bg-line" />
            </div>
            <button type="button" onClick={handleMagicLink} disabled={busy} className="btn btn-ghost py-2.5">
              <IconMail size={16} /> Recevoir un lien de connexion
            </button>
          </>
        )}
      </form>

      <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
        <IconShield size={15} className="shrink-0 text-act" />
        La double authentification est demandée à chaque connexion.
      </p>
    </AuthFrame>
  );
}
