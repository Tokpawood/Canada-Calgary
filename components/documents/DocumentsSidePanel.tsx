"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Gap, Identity } from "@/lib/types";
import { fmtShortDate } from "@/components/ui";
import { IconCheck, IconInfo, IconShield } from "@/components/icons";

const IDENTITY_FIELDS: Array<[keyof Identity, string]> = [
  ["nom", "Nom"],
  ["prenoms", "Prénoms"],
  ["naissance", "Naissance"],
  ["lieu", "Lieu de naissance"],
  ["pere", "Père"],
  ["mere", "Mère"],
];

export function DocumentsSidePanel({ identity, initialGaps }: { identity: Identity | null; initialGaps: Gap[] }) {
  const [gaps, setGaps] = useState(initialGaps);
  const supabase = createClient();
  const open = gaps.filter((g) => !g.done).length;

  async function toggleGap(id: string, done: boolean) {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, done } : g)));
    await supabase.from("gap").update({ done }).eq("id", id);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-3">
          <IconShield size={16} className="text-act" />
          <h2 className="text-[14px] font-bold">Identité de référence</h2>
        </div>
        <p className="px-4 pt-3 text-[12px] text-muted">Chaque document doit reprendre ces informations lettre pour lettre.</p>
        <dl className="px-4 pt-2 pb-4">
          {IDENTITY_FIELDS.map(([key, label]) => {
            const raw = identity?.[key] as string | null | undefined;
            const value = key === "naissance" ? fmtShortDate(raw) : raw;
            return (
              <div key={key} className="border-t border-line py-2 first:border-t-0">
                <dt className="text-[11.5px] text-faint">{label}</dt>
                <dd className={`text-[13.5px] font-semibold break-words ${value ? "" : "text-bad"}`}>{value || "manquant"}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold">Écarts à corriger</h2>
          {gaps.length > 0 && (
            <span className={`mono rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${open ? "bg-opt-bg text-opt" : "bg-ok-bg text-ok"}`}>
              {open ? `${open} ouvert(s)` : "tout corrigé"}
            </span>
          )}
        </div>
        {gaps.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Aucun écart signalé.</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {gaps.map((g) => (
              <li key={g.id}>
                <button type="button" role="checkbox" aria-checked={g.done} onClick={() => toggleGap(g.id, !g.done)} className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
                  <span className={`mt-0.5 grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border-2 ${g.done ? "border-ok bg-ok text-surface" : "border-line text-transparent"}`}>
                    <IconCheck size={10} strokeWidth={3.2} />
                  </span>
                  <span className={`text-[13px] leading-snug ${g.done ? "text-faint line-through" : ""}`}>{g.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-line p-4">
        <div className="flex items-center gap-2">
          <IconInfo size={15} className="text-muted" />
          <h2 className="text-[13px] font-bold">Règles de forme</h2>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] text-muted">
          <li>Nom et prénoms identiques, lettre pour lettre, sur tous les documents.</li>
          <li>Dates au format AAAA-MM-JJ (ou AAAA-MM si le jour est inconnu).</li>
          <li>Seuls les liens en https:// sont acceptés.</li>
          <li>Scans en PDF, JPEG, PNG ou WEBP, 20 Mo maximum.</li>
        </ul>
      </section>
    </div>
  );
}
