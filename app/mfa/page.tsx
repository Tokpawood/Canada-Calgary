"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFrame } from "@/components/AuthFrame";
import { IconShield } from "@/components/icons";
import { authErrorFr } from "@/components/PasswordInput";

/** Messages de Supabase (en anglais) traduits pour l'affichage. */
function mfaErrorFr(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid totp") || m.includes("invalid code") || (m.includes("code") && m.includes("invalid"))) return "Code incorrect ou expiré : saisissez le code actuellement affiché par l'application.";
  if (m.includes("expired")) return "Le code a expiré : saisissez le nouveau code affiché.";
  return authErrorFr(message);
}

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

  async function bootstrap() {
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(mfaErrorFr(listError.message));
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
      setError(enrollError ? mfaErrorFr(enrollError.message) : "Impossible de démarrer l'activation de la double authentification.");
      setPhase("error");
      return;
    }
    setFactorId(enrolled.id);
    setQrCode(enrolled.totp.qr_code);
    setSecret(enrolled.totp.secret);
    setPhase("enroll");
  }

  useEffect(() => {
    // bootstrap ne modifie l'état qu'après des appels réseau asynchrones
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void bootstrap();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verifyError) {
      setError(mfaErrorFr(verifyError.message));
      setCode("");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthFrame>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-act-soft text-act">
        <IconShield size={22} />
      </span>
      <h2 className="mt-4 font-display text-[26px] leading-tight font-bold">{phase === "enroll" ? "Activez la double authentification" : "Code de vérification"}</h2>
      <p className="mt-1 text-[14px] text-muted">
        {phase === "enroll"
          ? "Obligatoire : votre identité, vos documents et votre coffre sont des données sensibles."
          : "Saisissez le code à 6 chiffres affiché par votre application d'authentification."}
      </p>

      {phase === "loading" && (
        <p role="status" className="mt-6 text-[14px] text-muted">
          Préparation…
        </p>
      )}
      {phase === "error" && (
        <div className="mt-6 flex flex-col gap-3">
          <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
            {error}
          </p>
          <button type="button" className="btn btn-ghost self-start" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      )}

      {phase === "enroll" && qrCode && (
        <ol className="mt-6 flex flex-col gap-4">
          <li className="flex gap-3">
            <StepNum n={1} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Scannez ce code</p>
              <p className="text-[12.5px] text-muted">Avec Google Authenticator, Authy, 1Password ou équivalent.</p>
              <div className="mt-3 inline-block rounded-2xl border border-line bg-white p-3">
                {/* qr_code est déjà une image SVG encodée en data URI, fournie par Supabase */}
                <img src={qrCode} alt="Code QR d'inscription à la double authentification" className="h-40 w-40" />
              </div>
              {secret && (
                <details className="mt-2 text-[12.5px] text-muted">
                  <summary className="cursor-pointer font-semibold text-act">Saisir la clé manuellement</summary>
                  <p className="mono mt-1.5 rounded-lg bg-surface-2 p-2 text-[12px] break-all select-all">{secret}</p>
                </details>
              )}
            </div>
          </li>
          <li className="flex gap-3">
            <StepNum n={2} />
            <p className="pt-0.5 text-[14px] font-semibold">Saisissez le code généré</p>
          </li>
        </ol>
      )}

      {(phase === "enroll" || phase === "challenge") && (
        <form onSubmit={handleVerify} className="mt-5 flex flex-col gap-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus={phase === "challenge"}
            aria-label="Code à 6 chiffres"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="input mono py-3 text-center text-[26px] tracking-[0.5em]"
          />
          {error && (
            <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary py-2.5 text-[15px]">
            {busy ? "Vérification…" : "Valider"}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

function StepNum({ n }: { n: number }) {
  return <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full bg-night text-[12px] font-bold text-night-ink">{n}</span>;
}
