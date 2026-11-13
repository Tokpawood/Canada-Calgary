import type { ReactNode } from "react";
import { IconCheck } from "./icons";

const POINTS = ["Étapes, échéances et rappels", "Documents contrôlés et coffre chiffré", "Budget, épargne et grille de points"];

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative hidden overflow-hidden bg-night p-10 text-night-ink lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative flex items-baseline gap-3 font-mono font-semibold">
          <span className="text-2xl tracking-wide">ABJ</span>
          <span className="text-signal">→</span>
          <span className="text-2xl tracking-wide">YYC</span>
        </div>
        <div className="relative mt-auto">
          <svg viewBox="0 0 400 120" className="mb-8 w-full max-w-md" aria-hidden>
            <path d="M 10 110 Q 200 -20 390 110" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
            <path d="M 10 110 Q 200 -20 390 110" fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray="38 100" />
            <circle cx="10" cy="110" r="5" fill="var(--signal)" />
            <circle cx="390" cy="110" r="5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
          </svg>
          <h1 className="max-w-md font-display text-[38px] leading-[1.05] font-extrabold">Votre dossier Entrée express, de Abidjan à Calgary.</h1>
          <ul className="mt-6 flex flex-col gap-2.5 text-[14px] text-night-muted">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-signal">
                  <IconCheck size={12} strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex items-baseline gap-2.5 font-mono font-semibold lg:hidden">
          <span className="text-2xl">ABJ</span>
          <span className="text-signal">→</span>
          <span className="text-2xl">YYC</span>
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
