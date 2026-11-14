"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fundsProgress } from "@/lib/rules";
import type { Dossier, Saving } from "@/lib/types";
import { newId } from "@/lib/ids";
import { EmptyState, Meter, PageHeader, fcfa } from "@/components/ui";
import { EditBar, useEditable } from "@/components/editable";
import { syncRows } from "@/lib/syncRows";
import { IconCheck, IconPiggy, IconPlus, IconTrash } from "@/components/icons";

export function EpargneBoard({ dossier, initialSavings }: { dossier: Dossier; initialSavings: Saving[] }) {
  const [savedRows, setSavedRows] = useState(initialSavings);
  const [funds, setFunds] = useState({ fundsMin: dossier.fundsMin, fundsTarget: dossier.fundsTarget });
  const supabase = createClient();

  const fundsEd = useEditable(funds, async (d) => {
    const { error } = await supabase.from("dossier").update({ funds_min: d.fundsMin, funds_target: d.fundsTarget }).eq("id", dossier.id);
    if (error) throw error;
    setFunds(d);
  });

  const rowsEd = useEditable(savedRows, async (d) => {
    await syncRows(supabase, "saving", savedRows, d, (s) => ({ label: s.label, planned: s.planned, actual: s.actual, notes: s.notes }), { dossier_id: dossier.id });
    setSavedRows(d);
  });

  const savings = rowsEd.current;
  const { fundsMin, fundsTarget } = fundsEd.current;
  const off = !rowsEd.editing;

  const progress = useMemo(() => fundsProgress(savings, { fundsMin, fundsTarget }), [savings, fundsMin, fundsTarget]);
  const toMin = Math.max(0, fundsMin - progress.saved);
  const toTarget = Math.max(0, fundsTarget - progress.saved);
  const totalPlanned = savings.reduce((s, r) => s + (r.planned ?? 0), 0);

  const cumul = useMemo(
    () => savings.reduce<number[]>((out, s, i) => [...out, (i ? out[i - 1] : 0) + (s.actual ?? 0)], []),
    [savings],
  );

  function addRow() {
    if (!rowsEd.editing) rowsEd.start();
    rowsEd.update((d) => [...d, { id: newId("e"), dossierId: dossier.id, label: "", planned: null, actual: null, notes: "" }]);
  }

  function updateRow(id: string, patch: Partial<Saving>) {
    rowsEd.update((d) => d.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function deleteRow(id: string) {
    rowsEd.update((d) => d.filter((s) => s.id !== id));
  }

  const num = (v: string) => (v === "" ? null : Number(v));
  const cellEdit = off ? "" : "border-line bg-surface";
  const maxBar = Math.max(1, ...savings.map((s) => Math.max(s.actual ?? 0, s.planned ?? 0)));

  return (
    <>
      <PageHeader
        title="Épargne"
        description="Fonds d'établissement exigés par IRCC, objectif personnel et suivi des versements mensuels."
        actions={
          <button type="button" onClick={addRow} className="btn btn-primary">
            <IconPlus size={16} /> Versement
          </button>
        }
      />

      <section className="card p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <p className="text-[12.5px] font-medium text-muted">Épargne constituée</p>
            <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight">
              {fcfa(progress.saved)}
              <span className="ml-1.5 text-lg font-semibold text-muted">F</span>
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              soit <span className="mono font-semibold text-ink">{Math.round(progress.pctOfTarget)} %</span> de la cible de {fcfa(fundsTarget)} F
            </p>

            <Meter
              className="mt-5"
              height={10}
              value={progress.pctOfTarget}
              tone={progress.minReached ? "ok" : "act"}
              label="Épargne par rapport à la cible"
              markers={[{ pct: progress.minMarkPct, label: `Minimum exigé : ${fcfa(fundsMin)} F` }]}
            />
            <div className="mono relative mt-2 h-4 text-[10.5px] text-faint">
              <span className="absolute left-0">0</span>
              <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(88, progress.minMarkPct)}%` }}>
                minimum
              </span>
              {progress.minMarkPct < 88 && <span className="absolute right-0">cible</span>}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Goal reached={progress.minReached} label="Minimum exigé" rest={toMin} />
              <Goal reached={progress.targetReached} label="Cible" rest={toTarget} />
            </div>
          </div>

          <div className={`flex flex-col gap-3 rounded-xl border p-4 ${fundsEd.editing ? "border-act/30 bg-surface" : "border-transparent bg-surface-2/70"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">Objectifs</span>
              {!fundsEd.editing && <EditBar edit={fundsEd} />}
            </div>
            <label>
              <span className="field-label">Minimum exigé (FCFA)</span>
              <input
                type="number"
                inputMode="numeric"
                disabled={!fundsEd.editing}
                value={fundsMin}
                onChange={(e) => fundsEd.set({ fundsMin: Number(e.target.value) || 0 })}
                className="input mono text-right"
              />
            </label>
            <label>
              <span className="field-label">Cible personnelle (FCFA)</span>
              <input
                type="number"
                inputMode="numeric"
                disabled={!fundsEd.editing}
                value={fundsTarget}
                onChange={(e) => fundsEd.set({ fundsTarget: Number(e.target.value) || 0 })}
                className="input mono text-right"
              />
            </label>
            {fundsEd.editing && <EditBar edit={fundsEd} />}
            <p className="text-[11.5px] text-faint">Le minimum suit le barème IRCC des fonds d&apos;établissement ; mettez-le à jour chaque année.</p>
          </div>
        </div>
      </section>

      {savings.length === 0 && !rowsEd.editing ? (
        <div className="mt-5">
          <EmptyState icon={<IconPiggy size={20} />} title="Aucun versement">
            Ajoutez un premier versement mensuel pour suivre votre épargne.
          </EmptyState>
        </div>
      ) : (
        <section className={`card mt-5 overflow-hidden ${rowsEd.editing ? "ring-2 ring-act-soft" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
            <div>
              <h2 className="text-[17px] font-bold">Versements</h2>
              <p className="text-[12.5px] text-muted">
                Prévu <span className="mono text-ink">{fcfa(totalPlanned)} F</span> · versé <span className="mono text-ink">{fcfa(progress.saved)} F</span>
              </p>
            </div>
            <EditBar edit={rowsEd} />
          </div>

          <div className="px-4 pt-4 sm:px-5">
            <div className="flex gap-1.5" role="img" aria-label="Versements réels par mois, avec le montant prévu en repère">
              {savings.map((s) => {
                const actualH = ((s.actual ?? 0) / maxBar) * 100;
                const plannedH = ((s.planned ?? 0) / maxBar) * 100;
                const short = s.actual != null && s.planned != null && s.actual < s.planned;
                return (
                  <div key={s.id} className="group flex min-w-0 flex-1 flex-col items-center" title={`${s.label || "Sans libellé"} · versé ${fcfa(s.actual)} F · prévu ${fcfa(s.planned)} F`}>
                    <div className="relative flex h-28 w-full max-w-[34px] flex-col justify-end">
                      {s.planned != null && <span className="absolute -inset-x-1 z-10 h-[2px] rounded-full bg-ink/60" style={{ bottom: `${plannedH}%` }} />}
                      <span className={`block rounded-t-[4px] ${short ? "bg-act/55" : "bg-act"} group-hover:brightness-125`} style={{ height: `${actualH}%`, minHeight: s.actual ? 3 : 0 }} />
                    </div>
                    <span className="mt-1.5 w-full truncate text-center text-[10.5px] text-faint">{shortLabel(s.label)}</span>
                  </div>
                );
              })}
            </div>
            <ul className="mt-2 flex gap-4 text-[11.5px] text-muted">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-act" /> Versé
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-[2px] w-3 rounded-full bg-ink/60" /> Prévu
              </li>
            </ul>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead>
                <tr className="border-y border-line text-left text-[11.5px] text-muted">
                  <th className="px-4 py-2 font-medium sm:px-5">Mois</th>
                  <th className="px-2 py-2 text-right font-medium">Prévu</th>
                  <th className="px-2 py-2 text-right font-medium">Versé</th>
                  <th className="px-2 py-2 text-right font-medium">Écart</th>
                  <th className="px-2 py-2 text-right font-medium">Cumul</th>
                  <th className="px-2 py-2 font-medium">Notes</th>
                  {!off && <th className="w-12" />}
                </tr>
              </thead>
              <tbody>
                {savings.map((s, i) => {
                  const diff = s.actual != null && s.planned != null ? s.actual - s.planned : null;
                  return (
                    <tr key={s.id} className="group border-b border-line last:border-0">
                      <td className="py-1 pr-1 pl-3 sm:pl-4">
                        <input disabled={off} value={s.label} placeholder="Ex. Décembre 2026" aria-label="Mois" onChange={(e) => updateRow(s.id, { label: e.target.value })} className={`input-ghost font-semibold ${cellEdit}`} />
                      </td>
                      <td className="px-1 py-1">
                        <input disabled={off} type="number" inputMode="numeric" value={s.planned ?? ""} aria-label="Montant prévu" onChange={(e) => updateRow(s.id, { planned: num(e.target.value) })} className={`input-ghost mono w-28 text-right ${cellEdit}`} />
                      </td>
                      <td className="px-1 py-1">
                        <input disabled={off} type="number" inputMode="numeric" value={s.actual ?? ""} aria-label="Montant versé" onChange={(e) => updateRow(s.id, { actual: num(e.target.value) })} className={`input-ghost mono w-28 text-right ${cellEdit}`} />
                      </td>
                      <td className={`mono px-2 py-1 text-right text-[12.5px] ${diff == null ? "text-faint" : diff < 0 ? "text-bad" : "text-ok"}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fcfa(Math.abs(diff))}`}
                      </td>
                      <td className="mono px-2 py-1 text-right text-[12.5px] text-muted">{s.actual == null ? <span className="text-faint">—</span> : fcfa(cumul[i])}</td>
                      <td className="px-1 py-1">
                        <input disabled={off} value={s.notes} aria-label="Notes" onChange={(e) => updateRow(s.id, { notes: e.target.value })} className={`input-ghost ${cellEdit}`} />
                      </td>
                      {!off && (
                        <td className="py-1 pr-3 text-right">
                          <button type="button" onClick={() => deleteRow(s.id)} aria-label="Retirer le versement" title="Retirer le versement" className="btn btn-sm btn-danger">
                            <IconTrash size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/** « Novembre 2026 » → « nov. 26 » ; les autres libellés sont tronqués. */
function shortLabel(label: string): string {
  const m = /^(\p{L}+)\s+(\d{4})$/u.exec(label.trim());
  if (m) return `${m[1].slice(0, 3).toLowerCase()}. ${m[2].slice(2)}`;
  return label.trim().split(/\s+/)[0] ?? "";
}

function Goal({ reached, label, rest }: { reached: boolean; label: string; rest: number }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${reached ? "border-ok/30 bg-ok-bg" : "border-line"}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${reached ? "bg-ok text-surface" : "bg-surface-2 text-muted"}`}>
        {reached ? <IconCheck size={14} strokeWidth={3} /> : <IconPiggy size={14} />}
      </span>
      <span className="text-[13px]">
        <span className="block font-semibold">{label}</span>
        <span className={reached ? "text-ok" : "text-muted"}>{reached ? "atteint" : <>encore <span className="mono">{fcfa(rest)} F</span></>}</span>
      </span>
    </div>
  );
}
