"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dossier } from "@/lib/types";

interface Props {
  dossier: Dossier;
  rows: Array<{ phase: string; planned: number; actual: number }>;
}

export function BudgetBoard({ dossier, rows }: Props) {
  const [cadRate, setCadRate] = useState(dossier.cadRate);
  const supabase = createClient();

  const totalPlanned = rows.reduce((sum, r) => sum + r.planned, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);

  async function saveRate(value: number) {
    setCadRate(value);
    await supabase.from("dossier").update({ cad_rate: value }).eq("id", dossier.id);
  }

  function fcfa(n: number) {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n));
  }
  function cad(n: number) {
    return cadRate > 0 ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n / cadRate) : "—";
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <h3 className="text-base font-bold">Budget par phase</h3>
        <label className="text-sm text-muted">
          Taux FCFA → CAD : 1 CAD ={" "}
          <input
            type="number"
            value={cadRate}
            onChange={(e) => saveRate(Number(e.target.value) || 0)}
            className="ml-1 w-20 rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
          />{" "}
          FCFA
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2">Phase</th>
              <th className="px-4 py-2 text-right">Prévu (FCFA)</th>
              <th className="px-4 py-2 text-right">Payé (FCFA)</th>
              <th className="px-4 py-2 text-right">Payé (CAD)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.phase} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-semibold">{r.phase}</td>
                <td className="px-4 py-2 text-right font-mono">{fcfa(r.planned)}</td>
                <td className="px-4 py-2 text-right font-mono">{fcfa(r.actual)}</td>
                <td className="px-4 py-2 text-right font-mono text-muted">{cad(r.actual)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-bold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right font-mono">{fcfa(totalPlanned)}</td>
              <td className="px-4 py-2 text-right font-mono">{fcfa(totalActual)}</td>
              <td className="px-4 py-2 text-right font-mono text-muted">{cad(totalActual)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
