"use client";

import { DrawerCard } from "@/components/DrawerParts";
import { CONSIGNES, METHODES, exercicesFor, type Exercice } from "@/lib/sujets";
import type { DayItem } from "@/lib/formation";

export function Consigne({ kind }: { kind: Exercice["kind"] }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <p className="text-[11.5px] font-semibold text-muted">Consigne</p>
      <ul className="mt-1 flex flex-col gap-1 text-[13.5px] leading-snug">
        {CONSIGNES[kind].map((c) => (
          <li key={c}>• {c}</li>
        ))}
      </ul>
    </div>
  );
}

export function Methode({ kind }: { kind: Exercice["kind"] }) {
  return (
    <>
      <ol className="flex flex-col gap-2">
        {METHODES[kind].etapes.map((s, i) => (
          <li key={s} className="flex gap-2.5 text-[13.5px] leading-snug">
            <span className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {METHODES[kind].modele && (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-[11.5px] font-semibold text-muted">Phrases de départ</p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed whitespace-pre-line">{METHODES[kind].modele}</p>
        </div>
      )}
    </>
  );
}

/** Le sujet lui-même (énoncé, documents, questions ou phrases). */
export function Sujet({ e }: { e: Exercice }) {
  if (e.kind === "gram")
    return (
      <ol className="flex flex-col gap-3">
        {e.items.map(([q, r], i) => (
          <li key={i} className="text-[14px] leading-snug">
            <p>
              <span className="mono mr-1.5 text-[12px] text-muted">{i + 1}.</span>
              {q}
            </p>
            <details className="mt-1 text-[13px]">
              <summary className="cursor-pointer py-1 font-semibold text-muted">Voir la réponse</summary>
              <p className="rounded-lg bg-ok-bg px-2.5 py-1.5 text-ok">{r}</p>
            </details>
          </li>
        ))}
      </ol>
    );
  if (e.kind === "eo1")
    return (
      <ul className="flex flex-col gap-1.5 text-[14px] leading-snug">
        {e.questions.map((q) => (
          <li key={q}>• {q}</li>
        ))}
      </ul>
    );
  if (e.kind === "ee3")
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-[15px] font-semibold">{e.sujet.titre}</p>
        {[e.sujet.a, e.sujet.b].map((d, i) => (
          <div key={i} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-[11.5px] font-semibold text-muted">Document {i + 1}</p>
            <p className="mt-0.5 text-[14px] leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    );
  return <p className="text-[14.5px] leading-relaxed">{e.consigne}</p>;
}

/** Dans le tiroir d'une tâche : un sujet par tâche de l'épreuve, sa consigne et sa méthodologie. */
export function ExerciceCard({ date, item }: { date: string; item: DayItem }) {
  return (
    <>
      {exercicesFor(date, item).map((e) => (
        <DrawerCard key={e.kind} title={e.titre} sub={e.temps}>
          <div className="flex flex-col gap-3">
            <Sujet e={e} />
            <Consigne kind={e.kind} />
            <div>
              <p className="mb-2 text-[13.5px] font-bold">Méthodologie</p>
              <Methode kind={e.kind} />
            </div>
          </div>
        </DrawerCard>
      ))}
    </>
  );
}
