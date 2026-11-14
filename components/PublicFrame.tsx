import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export const APP_NAME = "Projet Canada Calgary";

/** Cadre des pages publiques (accueil, confidentialité, conditions) : aucune donnée personnelle. */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <header className="border-b border-white/10 bg-night text-night-ink" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={38} />
            <span>
              <span className="block font-display text-[16px] font-extrabold">{APP_NAME}</span>
              <span className="block text-[11.5px] text-night-muted">Suivi de dossier Entrée express</span>
            </span>
          </Link>
          <Link href="/login" className="btn btn-sm rounded-lg bg-signal px-3.5 py-2 text-[13px] font-bold text-black hover:opacity-90">
            Se connecter
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12.5px] text-muted sm:px-8">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <nav className="flex gap-5">
            <Link href="/" className="hover:text-ink">Accueil</Link>
            <Link href="/confidentialite" className="hover:text-ink">Règles de confidentialité</Link>
            <Link href="/conditions" className="hover:text-ink">Conditions d&apos;utilisation</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Mise en page d'un texte juridique. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="legal mx-auto w-full max-w-[760px] px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-[32px] leading-tight font-extrabold sm:text-[38px]">{title}</h1>
      <p className="mt-2 text-[13px] text-muted">Dernière mise à jour : {updated}</p>
      <div className="mt-8 flex flex-col gap-4 text-[15px] leading-relaxed">{children}</div>
    </article>
  );
}
