"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fundsProgress } from "@/lib/rules";
import type { Dossier, Saving } from "@/lib/types";

export function EpargneBoard({ dossier, initialSavings }: { dossier: Dossier; initialSavings: Saving[] }) {
  const [savings, setSavings] = useState(initialSavings);
  const [fundsMin, setFundsMin] = useState(dossier.fundsMin);
  const [fundsTarget, setFundsTarget] = useState(dossier.fundsTarget);
  const supabase = createClient();

  const progress = useMemo(() => fundsProgress(savings, { fundsMin, fundsTarget }), [savings, fundsMin, fundsTarget]);

  async function saveDossierField(field: "funds_min" | "funds_target", value: number) {
    await supabase.from("dossier").update({ [field]: value }).eq("id", dossier.id);
  }

  async function addRow() {
    const id = `e-${Date.now().toString(36)}`;
    setSavings((prev) => [...prev, { id, dossierId: dossier.id, label: "", planned: null, actual: null, notes: "" }]);
    await supabase.from("saving").insert({ id, dossier_id: dossier.id, label: "", position: savings.length });
  }

  async function updateRow(id: string, patch: Partial<Saving>) {
    setSavings((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await supabase.from("saving").update(patch).eq("id", id);
  }

  async function deleteRow(id: string) {
    setSavings((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("saving").delete().eq("id", id);
  }

  function fcfa(n: number) {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n));
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-base font-bold">Fonds d&apos;installation</h3>
          <div className="flex gap-4 text-sm text-muted">
            <label>
              Minimum exigé{" "}
              <input
                type="number"
                value={fundsMin}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setFundsMin(v);
                  saveDossierField("funds_min", v);
                }}
                className="ml-1 w-28 rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
              />
            </label>
            <label>
              Cible{" "}
              <input
                type="number"
                value={fundsTarget}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setFundsTarget(v);
                  saveDossierField("funds_target", v);
                }}
                className="ml-1 w-28 rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
              />
            </label>
          </div>
        </div>
        <p className="mt-3 font-display text-2xl font-bold">
          {fcfa(progress.saved)} F <span className="text-sm font-medium text-muted">sur {fcfa(fundsTarget)} F cible</span>
        </p>
        <div className="relative mt-2 h-2 rounded-full border border-line bg-surface-2">
          <span className="block h-full rounded-full bg-act" style={{ width: `${Math.min(100, progress.pctOfTarget)}%` }} />
          <i className="absolute -top-1 -bottom-1 w-[2px] rounded bg-bad" style={{ left: `${progress.minMarkPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {progress.minReached ? "Minimum exigé atteint. " : "Minimum exigé non atteint. "}
          {progress.targetReached ? "Cible atteinte." : "Cible non atteinte."}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-base font-bold">Versements mensuels</h3>
          <button type="button" onClick={addRow} className="rounded-md bg-act-soft px-2.5 py-1 text-xs font-semibold text-act">
            + Mois
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-line text-left text-xs text-muted">
              <th className="px-4 py-2">Libellé</th>
              <th className="px-4 py-2 text-right">Prévu</th>
              <th className="px-4 py-2 text-right">Réel</th>
              <th className="px-4 py-2">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {savings.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-1.5">
                  <input value={s.label} onChange={(e) => updateRow(s.id, { label: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-1.5">
                  <input
                    type="number"
                    value={s.planned ?? ""}
                    onChange={(e) => updateRow(s.id, { planned: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-28 rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
                  />
                </td>
                <td className="px-4 py-1.5">
                  <input
                    type="number"
                    value={s.actual ?? ""}
                    onChange={(e) => updateRow(s.id, { actual: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-28 rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
                  />
                </td>
                <td className="px-4 py-1.5">
                  <input value={s.notes} onChange={(e) => updateRow(s.id, { notes: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
                </td>
                <td className="px-2">
                  <button type="button" onClick={() => deleteRow(s.id)} className="text-xs text-faint hover:text-bad">
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
