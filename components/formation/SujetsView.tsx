"use client";

import { useState } from "react";
import { KINDS, intitule, sujetsOf, type Exercice } from "@/lib/sujets";
import { Consigne, Methode, Sujet } from "./ExerciceCard";

/** Banque de sujets : une épreuve à la fois, classée par thème, avec consigne et méthodologie. */
export function SujetsView({ week }: { week: number }) {
  const [kind, setKind] = useState<Exercice["kind"]>("ee3");
  const groups = sujetsOf(kind);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type de sujet">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)} className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold ${kind === k.kind ? "bg-ink text-surface" : "bg-surface-2 text-muted"}`}>
            {k.label}
          </button>
        ))}
      </div>

      <section className="card flex flex-col gap-3 px-4 py-4 sm:px-5">
        <Consigne kind={kind} />
        <details>
          <summary className="cursor-pointer py-1 text-[14px] font-bold">Méthodologie</summary>
          <div className="pt-2">
            <Methode kind={kind} />
          </div>
        </details>
      </section>

      {groups.map((g) => (
        <section key={`${kind}-${g.n}`} className="card px-4 py-4 sm:px-5">
          <h3 className="text-[14.5px] font-bold">
            {g.theme}
            {g.n === week && <span className="ml-2 rounded-full bg-signal px-2 py-px text-[11px] font-bold text-black">Cette semaine</span>}
          </h3>
          <div className="mt-1 flex flex-col">
            {g.items.map((e) => (
              <details key={intitule(e)} className="border-t border-line first:border-t-0">
                <summary className="cursor-pointer py-2 text-[13.5px] leading-snug font-medium">{intitule(e).length > 110 ? `${intitule(e).slice(0, 108)}…` : intitule(e)}</summary>
                <div className="pb-3">
                  <Sujet e={e} />
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
