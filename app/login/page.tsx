"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFrame } from "@/components/AuthFrame";
import { IconLock, IconMail } from "@/components/icons";
import { PasswordInput, authErrorFr } from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      setError(authErrorFr(err.message));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthFrame>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-act-soft text-act">
        <IconLock size={22} />
      </span>
      <h2 className="mt-4 font-display text-[28px] leading-tight font-bold">Connexion</h2>
      <p className="mt-1 text-[14px] text-muted">Connectez-vous avec votre courriel et votre mot de passe pour reprendre le suivi de votre dossier.</p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
        <label>
          <span className="field-label">Courriel</span>
          <span className="relative block">
            <IconMail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input py-3 pl-9 text-[15px]"
            />
          </span>
        </label>
        <label>
          <span className="field-label">Mot de passe</span>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !email || !password} className="btn btn-primary mt-1 py-3 text-[15px]">
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
        Accès réservé au titulaire du dossier : il n&apos;est pas possible de créer un compte. Le mot de passe se change une fois connecté, depuis « Compte et sécurité ».
      </p>
    </AuthFrame>
  );
}
