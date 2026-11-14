import Link from "next/link";
import { APP_NAME, PublicFrame } from "./PublicFrame";
import { IconCheck, IconLock } from "./icons";

const FEATURES = [
  { title: "Parcours", text: "Les étapes d'une demande de résidence permanente par Entrée express, avec mini-étapes, échéances et retards signalés." },
  { title: "Documents", text: "La liste des pièces à réunir, les contrôles à faire avant dépôt et les scans associés à chaque pièce." },
  { title: "Budget et épargne", text: "Les frais prévus et payés par phase, et le suivi de l'épargne par rapport aux fonds exigés." },
  { title: "Profil et contrôles", text: "La grille de points du Programme des travailleurs qualifiés et un contrôle de cohérence du dossier." },
];

/** Page d'accueil publique : présente l'application sans aucune donnée personnelle. */
export function LandingPage() {
  return (
    <PublicFrame>
      <section className="relative overflow-hidden bg-night text-night-ink">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative mx-auto w-full max-w-[1080px] px-5 py-14 sm:px-8 sm:py-20">
          <h1 className="anim-rise max-w-3xl font-display text-[36px] leading-[1.05] font-extrabold tracking-tight sm:text-[52px]">
            Organiser une demande d&apos;immigration au Canada, <span className="text-signal">étape par étape</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-night-muted">
            {APP_NAME} est une application web privée de suivi de dossier Entrée express : étapes, documents, budget et épargne réunis au
            même endroit. Elle est réservée à son titulaire ; la création de compte est fermée au public.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl bg-signal px-5 py-3 text-[14px] font-bold text-black hover:opacity-90">
              Se connecter
            </Link>
            <Link href="/confidentialite" className="rounded-xl border border-white/20 px-5 py-3 text-[14px] font-semibold hover:bg-white/10">
              Règles de confidentialité
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1080px] px-5 py-12 sm:px-8">
        <h2 className="font-display text-[24px] font-extrabold">Ce que fait l&apos;application</h2>
        <div className="stagger mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <p className="flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-act-soft text-act">
                  <IconCheck size={13} strokeWidth={3} />
                </span>
                {f.title}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1080px] px-5 pb-14 sm:px-8">
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-display text-[22px] font-extrabold">
            <IconLock size={20} /> Utilisation de Google Drive
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-[14.5px] leading-relaxed text-muted">
            <p>
              Le titulaire peut choisir de ranger les scans de ses documents dans son propre Google Drive. L&apos;application demande alors
              l&apos;autorisation <strong className="text-ink">« drive.file »</strong> : elle n&apos;accède qu&apos;aux dossiers et fichiers
              qu&apos;elle a elle-même créés, jamais au reste du Drive.
            </p>
            <p>
              Ces fichiers servent uniquement à les afficher et à les gérer dans l&apos;application (ajout, aperçu, remplacement, mise à la
              corbeille). Ils ne sont ni partagés, ni vendus, ni utilisés à des fins publicitaires. L&apos;accès peut être retiré à tout moment
              depuis l&apos;application ou depuis les paramètres du compte Google.
            </p>
            <p>
              Le détail figure dans les{" "}
              <Link href="/confidentialite" className="font-semibold text-act underline underline-offset-2">
                règles de confidentialité
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
