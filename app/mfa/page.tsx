"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase = "loading" | "enroll" | "challenge" | "error";

export default function MfaPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setPhase("error");
      return;
    }

    const verified = data.totp.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setPhase("challenge");
      return;
    }

    const existingUnverified = data.totp[0];
    if (existingUnverified) {
      await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id });
    }

    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Application d'authentification",
    });
    if (enrollError || !enrolled) {
      setError(enrollError?.message ?? "Impossible de démarrer l'inscription MFA.");
      setPhase("error");
      return;
    }
    setFactorId(enrolled.id);
    setQrCode(enrolled.totp.qr_code);
    setSecret(enrolled.totp.secret);
    setPhase("enroll");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h1 className="text-xl font-bold">Double authentification</h1>
        <p className="mt-1 text-sm text-muted">
          Obligatoire pour accéder au dossier : identité, documents et coffre y sont sensibles.
        </p>

        {phase === "loading" && <p className="mt-6 text-sm text-muted">Préparation…</p>}

        {phase === "error" && <p className="mt-6 text-sm text-bad">{error}</p>}

        {phase === "enroll" && qrCode && (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-sm">
              Scannez ce code avec une application d&apos;authentification (Google Authenticator, Authy, 1Password…).
            </p>
            {/* qr_code est déjà une image SVG encodée en data URI, fournie par Supabase */}
            <img src={qrCode} alt="Code QR d'inscription à la double authentification" className="mx-auto h-40 w-40" />
            {secret && (
              <p className="break-all rounded-md bg-surface-2 p-2 text-center font-mono text-xs text-muted">{secret}</p>
            )}
          </div>
        )}

        {(phase === "enroll" || phase === "challenge") && (
          <form onSubmit={handleVerify} className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Code à 6 chiffres
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-center font-mono text-lg tracking-widest text-ink focus:border-act focus:outline-none focus:ring-2 focus:ring-act-soft"
              />
            </label>
            {error && <p className="text-sm text-bad">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="rounded-lg bg-act px-4 py-2 font-semibold text-act-ink disabled:opacity-60"
            >
              Valider
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
