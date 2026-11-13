"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fundsProgress } from "@/lib/rules";
import type { Dossier, Saving } from "@/lib/types";
import { newId } from "@/lib/ids";
import { ConfirmButton, EmptyState, Meter, PageHeader, fcfa } from "@/components/ui";
import { IconCheck, IconPiggy, IconPlus, IconTrash } from "@/components/icons";

export function EpargneBoard({ dossier, initialSavings }: { dossier: Dossier; initialSavings: Saving[] }) {
  const [savings, setSavings] = useState(initialSavings);
  const [fundsMin, setFundsMin] = useState(dossier.fundsMin);
  const [fundsTarget, setFundsTarget] = useState(dossier.fundsTarget);
  const supabase = createClient();

  const progress = useMemo(() => fundsProgress(savings, { fundsMin, fundsTarget }), [savings, fundsMin, fundsTarget]);
  const toMin = Math.max(0, fundsMin - progress.saved);
  const toTarget = Math.max(0, fundsTarget - progress.saved);
  const totalPlanned = savings.reduce((s, r) => s + (r.planned ?? 0), 0);

  const cumul = useMemo(
    () => savings.reduce<number[]>((out, s, i) => [...out, (i ? out[i - 1] : 0) + (s.actual ?? 0)], []),
    [savings],
  );

  async function saveDossierField(field: "funds_min" | "funds_target", value: number) {
    await supabase.from("dossier").update({ [field]: value }).eq("id", dossier.id);
  }

  async function addRow() {
    const id = newId("e");
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

  const num = (v: string) => (v === "" ? null : Number(v));
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

          <div className="flex flex-col gap-3 rounded-xl bg-surface-2/70 p-4">
            <label>
              <span className="field-label">Minimum exigé (FCFA)</span>
              <input
                type="number"
                inputMode="numeric"
                value={fundsMin}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setFundsMin(v);
                  void saveDossierField("funds_min", v);
                }}
                className="input mono text-right"
              />
            </label>
            <label>
              <span className="field-label">Cible personnelle (FCFA)</span>
              <input
                type="number"
                inputMode="numeric"
                value={fundsTarget}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setFundsTarget(v);
                  void saveDossierField("funds_target", v);
                }}
                className="input mono text-right"
              />
            </label>
            <p className="text-[11.5px] text-faint">Le minimum suit le barème IRCC des fonds d&apos;établissement ; mettez-le à jour chaque année.</p>
          </div>
        </div>
      </section>

      {savings.length === 0 ? (
        <div className="mt-5">
          <EmptyState icon={<IconPiggy size={20} />} title="Aucun versement">
            Ajoutez un premier versement mensuel pour suivre votre épargne.
          </EmptyState>
        </div>
      ) : (
        <section className="card mt-5 overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
            <h2 className="text-[17px] font-bold">Versements</h2>
            <p className="text-[12.5px] text-muted">
              Prévu <span className="mono text-ink">{fcfa(totalPlanned)} F</span> · versé <span className="mono text-ink">{fcfa(progress.saved)} F</span>
            </p>
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
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {savings.map((s, i) => {
                  const diff = s.actual != null && s.planned != null ? s.actual - s.planned : null;
                  return (
                    <tr key={s.id} className="group border-b border-line last:border-0">
                      <td className="py-1 pr-1 pl-3 sm:pl-4">
                        <input value={s.label} placeholder="Ex. Décembre 2026" aria-label="Mois" onChange={(e) => updateRow(s.id, { label: e.target.value })} className="input-ghost font-semibold" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" inputMode="numeric" value={s.planned ?? ""} aria-label="Montant prévu" onChange={(e) => updateRow(s.id, { planned: num(e.target.value) })} className="input-ghost mono w-28 text-right" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" inputMode="numeric" value={s.actual ?? ""} aria-label="Montant versé" onChange={(e) => updateRow(s.id, { actual: num(e.target.value) })} className="input-ghost mono w-28 text-right" />
                      </td>
                      <td className={`mono px-2 py-1 text-right text-[12.5px] ${diff == null ? "text-faint" : diff < 0 ? "text-bad" : "text-ok"}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fcfa(Math.abs(diff))}`}
                      </td>
                      <td className="mono px-2 py-1 text-right text-[12.5px] text-muted">{s.actual == null ? <span className="text-faint">—</span> : fcfa(cumul[i])}</td>
                      <td className="px-1 py-1">
                        <input value={s.notes} aria-label="Notes" onChange={(e) => updateRow(s.id, { notes: e.target.value })} className="input-ghost" />
                      </td>
                      <td className="py-1 pr-3 text-right">
                        <ConfirmButton label="Supprimer le versement" confirmLabel="Oui ?" onConfirm={() => deleteRow(s.id)} className="btn btn-sm btn-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 data-[armed=true]:opacity-100">
                          <IconTrash size={13} />
                        </ConfirmButton>
                      </td>
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
