"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Gap, Identity } from "@/lib/types";

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

  async function toggleGap(id: string, done: boolean) {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, done } : g)));
    await supabase.from("gap").update({ done }).eq("id", id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <h3 className="text-sm font-bold">Identité de référence</h3>
        <dl className="mt-2 flex flex-col gap-1.5 text-sm">
          {IDENTITY_FIELDS.map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-muted">{label}</dt>
              <dd className={`text-right ${!identity?.[key] ? "text-bad" : ""}`}>{(identity?.[key] as string) || "manquant"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <h3 className="text-sm font-bold">Écarts à corriger</h3>
        {gaps.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucun écart signalé.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {gaps.map((g) => (
              <li key={g.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={g.done} onChange={(e) => toggleGap(g.id, e.target.checked)} className="mt-0.5" />
                <span className={g.done ? "text-faint line-through" : ""}>{g.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <h3 className="text-sm font-bold">Règles de forme</h3>
        <ul className="mt-2 list-disc pl-4 text-sm text-muted">
          <li>Nom et prénoms identiques, lettre pour lettre, sur tous les documents.</li>
          <li>Dates au format AAAA-MM-JJ (ou AAAA-MM si le jour est inconnu).</li>
          <li>Seuls les liens en https:// sont acceptés.</li>
          <li>Scans en PDF, JPEG, PNG ou WEBP, 20 Mo maximum.</li>
        </ul>
      </div>
    </div>
  );
}
