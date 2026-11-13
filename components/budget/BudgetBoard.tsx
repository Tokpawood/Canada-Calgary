"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dossier } from "@/lib/types";
import { Chip, Meter, PageHeader, dueInfo, fcfa } from "@/components/ui";

interface Props {
  dossier: Dossier;
  rows: Array<{ phase: string; planned: number; actual: number }>;
  upcoming: Array<{ id: string; title: string; due: string | null; planned: number; phase: string }>;
}

export function BudgetBoard({ dossier, rows, upcoming }: Props) {
  const [cadRate, setCadRate] = useState(dossier.cadRate);
  const supabase = createClient();

  const totalPlanned = rows.reduce((sum, r) => sum + r.planned, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const remaining = Math.max(0, totalPlanned - totalActual);
  const upcomingTotal = upcoming.reduce((s, u) => s + u.planned, 0);

  async function saveRate(value: number) {
    setCadRate(value);
    await supabase.from("dossier").update({ cad_rate: value }).eq("id", dossier.id);
  }

  const cad = (n: number) => (cadRate > 0 ? `≈ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n / cadRate)} $ CA` : "—");

  return (
    <>
      <PageHeader
        title="Budget"
        description="Frais prévus et payés pour chaque phase du parcours, d'après les coûts saisis dans les étapes."
        actions={
          <label className="card flex items-center gap-2 px-3 py-1.5 text-[13px] text-muted shadow-none">
            1 $ CA =
            <input
              type="number"
              inputMode="numeric"
              value={cadRate}
              onChange={(e) => saveRate(Number(e.target.value) || 0)}
              aria-label="Taux de conversion, en francs CFA pour un dollar canadien"
              className="input mono w-20 py-1 text-right"
            />
            FCFA
          </label>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Budget prévu" value={totalPlanned} sub={cad(totalPlanned)} />
        <Tile label="Déjà payé" value={totalActual} sub={cad(totalActual)} pct={totalPlanned ? (totalActual / totalPlanned) * 100 : 0} />
        <Tile label="Reste à payer" value={remaining} sub={cad(remaining)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 sm:px-5">
            <h2 className="text-[17px] font-bold">Par phase</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] text-muted">
                  <th className="px-4 py-2 font-medium sm:px-5">Phase</th>
                  <th className="w-[28%] px-3 py-2 font-medium">Payé / prévu</th>
                  <th className="px-3 py-2 text-right font-medium">Prévu</th>
                  <th className="px-3 py-2 text-right font-medium">Payé</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">Reste</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const pct = r.planned > 0 ? (r.actual / r.planned) * 100 : 0;
                  const over = r.actual > r.planned && r.planned > 0;
                  return (
                    <tr key={r.phase} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-4 py-3 sm:px-5">
                        <span className="flex items-center gap-2.5">
                          <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full bg-act-soft text-[11px] font-bold text-act">{i + 1}</span>
                          <span className="font-semibold">{r.phase.replace(/^\d+\.\s*/, "")}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3" title={`${Math.round(pct)} % payé`}>
                        {r.planned > 0 ? (
                          <span className="flex items-center gap-2">
                            <Meter value={pct} tone={over ? "bad" : pct >= 100 ? "ok" : "act"} height={5} className="flex-1" label={`Phase ${r.phase}, part payée`} />
                            <span className="mono w-9 text-right text-[11.5px] text-muted">{Math.round(pct)}%</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-faint">aucun coût prévu</span>
                        )}
                      </td>
                      <td className="mono px-3 py-3 text-right">{fcfa(r.planned)}</td>
                      <td className="mono px-3 py-3 text-right">{fcfa(r.actual)}</td>
                      <td className={`mono px-4 py-3 text-right sm:px-5 ${over ? "text-bad" : "text-muted"}`}>
                        {over ? `+${fcfa(r.actual - r.planned)}` : fcfa(Math.max(0, r.planned - r.actual))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-surface-2/60 font-bold">
                  <td className="px-4 py-3 sm:px-5" colSpan={2}>
                    Total <span className="ml-1 text-[12px] font-medium text-muted">en FCFA</span>
                  </td>
                  <td className="mono px-3 py-3 text-right">{fcfa(totalPlanned)}</td>
                  <td className="mono px-3 py-3 text-right">{fcfa(totalActual)}</td>
                  <td className="mono px-4 py-3 text-right sm:px-5">{fcfa(remaining)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="card self-start overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
            <h2 className="text-[15px] font-bold">Prochaines dépenses</h2>
            {upcoming.length > 0 && <span className="mono text-[12px] text-muted">{fcfa(upcomingTotal)} F</span>}
          </div>
          {upcoming.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">Aucune dépense prévue en attente de paiement.</p>
          ) : (
            <ul>
              {upcoming.map((u) => {
                const due = dueInfo(u.due, true);
                return (
                  <li key={u.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{u.title}</span>
                      {due && (
                        <Chip tone={due.tone} className="mono mt-1">
                          {due.text}
                        </Chip>
                      )}
                    </span>
                    <span className="mono shrink-0 text-[13px]">{fcfa(u.planned)} F</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Tile({ label, value, sub, pct }: { label: string; value: number; sub: string; pct?: number }) {
  return (
    <div className="card p-4">
      <p className="text-[12.5px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 font-display text-[26px] leading-none font-bold tracking-tight">
        {fcfa(value)}
        <span className="ml-1 text-sm font-semibold text-muted">F</span>
      </p>
      <p className="mono mt-1.5 text-[12px] text-muted">{sub}</p>
      {pct != null && <Meter className="mt-3" value={pct} label={label} />}
    </div>
  );
}
