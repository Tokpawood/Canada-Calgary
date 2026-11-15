import Link from "next/link";
import type { ReactNode } from "react";
import { IconCheck, IconLock } from "./icons";
import { Logo } from "./Logo";
import { APP_NAME } from "./PublicFrame";

const POINTS = ["Étapes, échéances et rappels", "Documents contrôlés et coffre privé", "Budget, épargne et grille de points"];

/**
 * Cadre des écrans d'accès : panneau sombre (trajet vers YYC) et carte de formulaire.
 * Écran public : aucun nom ni aucune information personnelle du titulaire (ni sa ville de départ).
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative hidden overflow-hidden bg-night p-10 text-night-ink lg:flex lg:flex-col xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-signal opacity-[0.08] blur-3xl" />

        <div className="anim-rise relative flex items-center gap-3">
          <Logo size={46} />
          <span>
            <span className="block font-display text-[20px] font-extrabold">{APP_NAME}</span>
            <span className="block text-[12px] text-night-muted">Suivi de dossier Entrée express</span>
          </span>
        </div>

        <div className="relative mt-auto">
          <svg viewBox="0 0 420 130" className="auth-arc mb-8 w-full max-w-lg overflow-visible" aria-hidden>
            <path d="M 12 112 Q 210 -24 408 112" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
            <path d="M 12 112 Q 210 -24 408 112" fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray="34 100" className="auth-arc-progress" />
            <circle cx="12" cy="112" r="5" fill="var(--signal)" />
            <circle cx="12" cy="112" r="5" fill="none" stroke="var(--signal)" strokeWidth="2" className="pulse-ring" />
            <circle cx="408" cy="112" r="5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <text x="12" y="130" fill="var(--night-muted)" fontSize="13" fontFamily="var(--font-mono)" textAnchor="start">Départ</text>
            <text x="408" y="130" fill="var(--night-muted)" fontSize="13" fontFamily="var(--font-mono)" textAnchor="middle">YYC</text>
          </svg>
          <h1 className="anim-rise [animation-delay:120ms] max-w-lg font-display text-[40px] leading-[1.05] font-extrabold tracking-tight">
            Votre dossier Entrée express, étape par étape jusqu&apos;à <span className="text-signal">Calgary</span>.
          </h1>
          <ul className="stagger mt-7 flex flex-col gap-3 text-[14.5px] text-night-muted">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-signal">
                  <IconCheck size={13} strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-10 flex items-center gap-2 text-[12px] text-night-muted">
            <IconLock size={13} /> Espace personnel, accès réservé au titulaire du dossier.
          </p>
        </div>
      </div>

      <div
        className="flex flex-col items-center justify-center px-4 py-10 sm:px-10"
        style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top, 0px))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <Logo size={42} />
          <span>
            <span className="block font-display text-[18px] font-extrabold">{APP_NAME}</span>
            <span className="block text-[12px] text-muted">Suivi de dossier Entrée express</span>
          </span>
        </Link>
        <main className="anim-pop card w-full max-w-[440px] p-6 sm:p-8">{children}</main>
        <nav aria-label="Informations" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
          <Link href="/" className="hover:text-ink">
            Accueil
          </Link>
          <Link href="/confidentialite" className="hover:text-ink">
            Règles de confidentialité
          </Link>
          <Link href="/conditions" className="hover:text-ink">
            Conditions d&apos;utilisation
          </Link>
        </nav>
      </div>
    </div>
  );
}
