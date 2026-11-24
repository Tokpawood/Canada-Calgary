"use client";

import { DrawerCard } from "@/components/DrawerParts";
import { autresSujets, exercicesFor, intitule, type Exercice } from "@/lib/sujets";
import type { DayItem } from "@/lib/formation";

function Body({ e }: { e: Exercice }) {
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
        <p className="text-[13px]">Présentez les deux points de vue avec vos propres mots, puis donnez votre opinion sur la question.</p>
      </div>
    );
  return <p className="text-[14.5px] leading-relaxed">{e.consigne}</p>;
}

function meta(e: Exercice): string {
  if ("mots" in e) return `${e.mots} · ${e.temps}`;
  return "temps" in e ? e.temps : "";
}

/** Exercice à faire pour la tâche, puis d'autres sujets du même type. */
export function ExerciceCard({ date, item }: { date: string; item: DayItem }) {
  const list = exercicesFor(date, item);
  if (!list.length) return null;
  const others = autresSujets(date, item);
  // Le test de l'application fournit déjà le sujet officiel du jour : celui-ci vient en plus.
  const extra = item.tool === "tcf";
  return (
    <>
      {list.map((e) => (
        <DrawerCard key={e.titre + intitule(e)} title={extra ? "Sujet en plus du test" : "Exercice à faire"} sub={[e.titre, meta(e)].filter(Boolean).join(" · ")}>
          {extra && <p className="mb-2 text-[12.5px] text-muted">Le test TCF Canada du jour a son propre sujet, corrigé par Claude. Celui-ci est facultatif.</p>}
          <Body e={e} />
        </DrawerCard>
      ))}
      {others.length > 0 && (
        <DrawerCard title="Autres exemples de sujets" sub={`${others.length} sujets`}>
          <div className="flex flex-col">
            {others.map((e) => (
              <details key={intitule(e)} className="border-t border-line py-1 first:border-t-0">
                <summary className="cursor-pointer py-1.5 text-[13.5px] leading-snug font-medium">
                  {e.kind === "ee1" ? "Tâche 1 · " : e.kind === "ee2" ? "Tâche 2 · " : ""}
                  {intitule(e).length > 90 ? `${intitule(e).slice(0, 88)}…` : intitule(e)}
                </summary>
                <div className="pt-1 pb-2">
                  <Body e={e} />
                  <p className="mt-1.5 text-[12px] text-muted">{meta(e)}</p>
                </div>
              </details>
            ))}
          </div>
        </DrawerCard>
      )}
    </>
  );
}
