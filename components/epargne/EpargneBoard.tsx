"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fundsProgress } from "@/lib/rules";
import type { Dossier, Saving } from "@/lib/types";
import type { Rates } from "@/lib/currency";
import { newId } from "@/lib/ids";
import { fundsError, monthsFromNow, savingsError, suggestNextLabel } from "@/lib/epargne";
import { EmptyState, PageHeader, fcfa } from "@/components/ui";
import { EditBar, useEditable } from "@/components/editable";
import { syncRows } from "@/lib/syncRows";
import { IconCheck, IconPiggy, IconPlus, IconTrash, IconWallet } from "@/components/icons";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";
import { StatsRow } from "@/components/StatsRow";

const TABS = ["evolution", "versements", "objectifs"] as const;
type Tab = (typeof TABS)[number];

export function EpargneBoard({ dossier, initialSavings, rates }: { dossier: Dossier; initialSavings: Saving[]; rates: Rates | null }) {
  const [savedRows, setSavedRows] = useState(initialSavings);
  const [funds, setFunds] = useState({ fundsMin: dossier.fundsMin, fundsMinCad: dossier.fundsMinCad, fundsTarget: dossier.fundsTarget });
  const [tab, setTab] = useHashTab<Tab>(TABS, "evolution");
  const supabase = createClient();

  const fundsEd = useEditable(funds, async (d) => {
    const invalid = fundsError(d.fundsMin, d.fundsTarget);
    if (invalid) throw new Error(invalid);
    const { error } = await supabase.from("dossier").update({ funds_min: d.fundsMin, funds_min_cad: d.fundsMinCad, funds_target: d.fundsTarget }).eq("id", dossier.id);
    if (error) throw error;
    setFunds(d);
  });

  const rowsEd = useEditable(savedRows, async (d) => {
    const invalid = savingsError(d);
    if (invalid) throw new Error(invalid);
    await syncRows(supabase, "saving", savedRows, d, (s) => ({ label: s.label, planned: s.planned, actual: s.actual, notes: s.notes }), { dossier_id: dossier.id });
    setSavedRows(d);
  });

  const savings = rowsEd.current;
  const { fundsMin, fundsMinCad, fundsTarget } = fundsEd.current;
  const off = !rowsEd.editing;

  const progress = useMemo(() => fundsProgress(savings, { fundsMin, fundsTarget }), [savings, fundsMin, fundsTarget]);
  const toMin = Math.max(0, fundsMin - progress.saved);
  const toTarget = Math.max(0, fundsTarget - progress.saved);
  const totalPlanned = savings.reduce((s, r) => s + (r.planned ?? 0), 0);

  const cumul = useMemo(
    () => savings.reduce<number[]>((out, s, i) => [...out, (i ? out[i - 1] : 0) + (s.actual ?? 0)], []),
    [savings],
  );

  const paid = savings.filter((s) => s.actual != null && s.actual > 0);
  const avg = paid.length ? paid.reduce((s, r) => s + (r.actual ?? 0), 0) / paid.length : 0;
  const best = paid.reduce<Saving | null>((b, s) => (!b || (s.actual ?? 0) > (b.actual ?? 0) ? s : b), null);
  const gap = paid.reduce((s, r) => s + (r.actual ?? 0) - (r.planned ?? 0), 0);
  const monthsToMin = !progress.minReached && avg > 0 ? Math.ceil(toMin / avg) : null;
  const monthsToTarget = !progress.targetReached && avg > 0 ? Math.ceil(toTarget / avg) : null;

  // IRCC fixe les fonds en dollars canadiens : équivalent au taux du jour, sinon au taux enregistré.
  const cadRate = rates?.perXof.CAD ?? (dossier.cadRate > 0 ? dossier.cadRate : null);
  const inCad = (n: number) => (cadRate ? `≈ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n / cadRate)} $ CA` : null);
  const toCad = (n: number) => (cadRate ? Math.round(n / cadRate) : 0);
  const fundsInvalid = fundsEd.editing ? fundsError(fundsMin, fundsTarget) : null;
  const rowsInvalid = rowsEd.editing ? savingsError(savings) : null;
  const totalActual = progress.saved;
  const totalGap = savings.reduce((s, r) => s + (r.actual != null && r.planned != null ? r.actual - r.planned : 0), 0);
  const rateNote = rates ? `au taux du jour (1 $ CA = ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(rates.perXof.CAD)} F)` : "au taux enregistré";

  function addRow() {
    setTab("versements");
    if (!rowsEd.editing) rowsEd.start();
    // Mois suivant le dernier versement et même montant prévu : il ne reste qu'à saisir le versé.
    rowsEd.update((d) => {
      const last = d[d.length - 1];
      return [...d, { id: newId("e"), dossierId: dossier.id, label: suggestNextLabel(d.map((s) => s.label)), planned: last?.planned ?? null, actual: null, notes: "" }];
    });
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

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              {
                label: "Minimum exigé",
                value: progress.minReached ? "Atteint" : fcfa(toMin),
                unit: progress.minReached ? undefined : "F",
                sub: progress.minReached ? `${fcfa(fundsMin)} F` : monthsToMin != null ? `≈ ${monthsToMin} mois · ${monthsFromNow(monthsToMin)}` : "restant à épargner",
                pct: fundsMin ? (progress.saved / fundsMin) * 100 : 0,
                tone: progress.minReached ? "ok" : "signal",
              },
              {
                label: "Cible",
                value: progress.targetReached ? "Atteinte" : fcfa(toTarget),
                unit: progress.targetReached ? undefined : "F",
                sub: progress.targetReached ? `${fcfa(fundsTarget)} F` : monthsToTarget != null ? `≈ ${monthsToTarget} mois · ${monthsFromNow(monthsToTarget)}` : "restant à épargner",
                pct: progress.pctOfTarget,
                tone: progress.targetReached ? "ok" : "signal",
              },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Sections de l'épargne"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "evolution", label: "Évolution", icon: <IconPiggy size={15} /> },
              { id: "versements", label: "Versements", icon: <IconWallet size={15} />, badge: { text: String(savings.length) }, dirty: rowsEd.editing },
              { id: "objectifs", label: "Objectifs", icon: <IconCheck size={15} />, dirty: fundsEd.editing },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Épargne constituée</p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {fcfa(progress.saved)}
          <span className="ml-1.5 text-[22px] text-signal">F</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          {inCad(progress.saved) && <span className="mono text-night-ink">{inCad(progress.saved)}</span>}
          {inCad(progress.saved) && " · "}
          {fundsTarget > 0 ? (
            <>
              soit <span className="mono font-semibold text-night-ink">{Math.round(progress.pctOfTarget)} %</span> de la cible de {fcfa(fundsTarget)} F
            </>
          ) : (
            "aucune cible définie (onglet Objectifs)"
          )}
        </p>
        <div className="relative mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${progress.minReached ? "bg-ok" : "bg-signal"}`} style={{ width: `${Math.min(100, progress.pctOfTarget)}%` }} />
          </div>
          <span
            className="absolute -top-1 h-[18px] w-0.5 rounded bg-night-ink"
            style={{ left: `${Math.min(100, progress.minMarkPct)}%` }}
            title={`Minimum exigé : ${fcfa(fundsMin)} F`}
          />
        </div>
        <div className="mono relative mt-2 h-4 text-[10.5px] text-night-muted">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(88, progress.minMarkPct)}%` }}>
            minimum
          </span>
          {progress.minMarkPct < 88 && <span className="absolute right-0">cible</span>}
        </div>
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
      {tab === "evolution" && (
        <div className="flex flex-col gap-5">
          <StatsRow
            className=""
            stats={[
              { label: "Versements", value: String(paid.length), unit: `/ ${savings.length}`, sub: "mois avec un versement" },
              { label: "Moyenne mensuelle", value: fcfa(avg), unit: "F", sub: "sur les mois versés" },
              { label: "Meilleur mois", value: best ? fcfa(best.actual) : "—", unit: best ? "F" : undefined, sub: best?.label || "aucun versement" },
              {
                label: "Écart au prévu",
                value: `${gap > 0 ? "+" : gap < 0 ? "−" : ""}${fcfa(Math.abs(gap))}`,
                unit: "F",
                sub: "versé moins prévu, mois versés",
                valueTone: gap < 0 ? "bad" : "ok",
              },
            ]}
          />
          {savings.length === 0 ? (
            <EmptyState icon={<IconPiggy size={20} />} title="Aucun versement">
              Ajoutez un premier versement mensuel pour suivre votre épargne.
            </EmptyState>
          ) : (
          <section className="card overflow-hidden pb-4">
          <div className="px-4 pt-4 sm:px-5">
            <h2 className="text-[16px] font-bold">Versements par mois</h2>
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
          </section>
          )}
        </div>
      )}

      {tab === "versements" && (
        <section className={`card overflow-hidden ${rowsEd.editing ? "ring-2 ring-act-soft" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
            <div>
              <h2 className="text-[16px] font-bold">Versements</h2>
              <p className="text-[12.5px] text-muted">Un mois par ligne ; l&apos;écart compare le versé au prévu.</p>
            </div>
            <EditBar edit={rowsEd} />
          </div>
          {rowsInvalid && (
            <p role="alert" className="mx-4 mt-3 text-[12.5px] font-semibold text-bad sm:mx-5">
              {rowsInvalid}
            </p>
          )}
          {savings.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-muted">Aucun versement. Utilisez le bouton « Versement » pour en ajouter un.</p>
          )}
          {savings.length > 0 && (
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
                        <input disabled={off} value={s.label} placeholder="Ex. Décembre 2026" aria-label={`Mois, ligne ${i + 1}`} onChange={(e) => updateRow(s.id, { label: e.target.value })} className={`input-ghost font-semibold ${cellEdit}`} />
                      </td>
                      <td className="px-1 py-1">
                        <input disabled={off} type="number" inputMode="numeric" value={s.planned ?? ""} aria-label={`Montant prévu, ${s.label || `ligne ${i + 1}`}`} min={0} onChange={(e) => updateRow(s.id, { planned: num(e.target.value) })} className={`input-ghost mono w-28 text-right ${cellEdit}`} />
                      </td>
                      <td className="px-1 py-1">
                        <input disabled={off} type="number" inputMode="numeric" value={s.actual ?? ""} aria-label={`Montant versé, ${s.label || `ligne ${i + 1}`}`} min={0} onChange={(e) => updateRow(s.id, { actual: num(e.target.value) })} className={`input-ghost mono w-28 text-right ${cellEdit}`} />
                      </td>
                      <td className={`mono px-2 py-1 text-right text-[12.5px] ${diff == null ? "text-faint" : diff < 0 ? "text-bad" : "text-ok"}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fcfa(Math.abs(diff))}`}
                      </td>
                      <td className="mono px-2 py-1 text-right text-[12.5px] text-muted">{s.actual == null ? <span className="text-faint">—</span> : fcfa(cumul[i])}</td>
                      <td className="px-1 py-1">
                        <input disabled={off} value={s.notes} aria-label={`Notes, ${s.label || `ligne ${i + 1}`}`} onChange={(e) => updateRow(s.id, { notes: e.target.value })} className={`input-ghost ${cellEdit}`} />
                      </td>
                      {!off && (
                        <td className="py-1 pr-3 text-right">
                          <button type="button" onClick={() => deleteRow(s.id)} aria-label={`Retirer le versement ${s.label || `ligne ${i + 1}`}`} title="Retirer le versement" className="btn btn-sm btn-danger">
                            <IconTrash size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-surface-2/60 font-bold">
                  <td className="px-4 py-2.5 sm:px-5">Total</td>
                  <td className="mono px-2 py-2.5 text-right">{fcfa(totalPlanned)}</td>
                  <td className="mono px-2 py-2.5 text-right">{fcfa(totalActual)}</td>
                  <td className={`mono px-2 py-2.5 text-right text-[12.5px] ${totalGap < 0 ? "text-bad" : "text-ok"}`}>
                    {`${totalGap > 0 ? "+" : totalGap < 0 ? "−" : ""}${fcfa(Math.abs(totalGap))}`}
                  </td>
                  <td className="mono px-2 py-2.5 text-right text-[12.5px] text-muted">{inCad(totalActual) ?? ""}</td>
                  <td colSpan={off ? 1 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </section>
      )}

      {tab === "objectifs" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className={`card p-4 sm:p-6 ${fundsEd.editing ? "ring-2 ring-act-soft" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold">Objectifs d&apos;épargne</h2>
                <p className="text-[12.5px] text-muted">Le minimum IRCC et votre cible personnelle.</p>
              </div>
              <EditBar edit={fundsEd} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">Minimum exigé (FCFA)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  disabled={!fundsEd.editing}
                  value={fundsMin}
                  onChange={(e) => fundsEd.set({ fundsMin: Number(e.target.value) || 0, fundsMinCad: null })}
                  className="input mono text-right text-[16px] font-semibold"
                />
                {fundsEd.editing && cadRate ? (
                  <span className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] text-muted">
                    ou en $ CA
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={fundsMinCad ?? (toCad(fundsMin) || "")}
                      onChange={(e) => {
                        const cad = Math.max(0, Math.round(Number(e.target.value) || 0));
                        fundsEd.set({ fundsMinCad: cad || null, fundsMin: Math.round(cad * cadRate) });
                      }}
                      aria-label="Minimum exigé, en dollars canadiens"
                      className="input mono w-28 py-1 text-right text-[13px]"
                    />
                  </span>
                ) : (
                  fundsMinCad ? (
                    <span className="mt-1 block text-right text-[12px] text-muted">
                      Fixé à <span className="mono font-semibold text-ink">{new Intl.NumberFormat("fr-FR").format(fundsMinCad)} $ CA</span> · suit le taux
                    </span>
                  ) : (
                    inCad(fundsMin) && <span className="mono mt-1 block text-right text-[12px] text-muted">{inCad(fundsMin)}</span>
                  )
                )}
              </label>
              <label>
                <span className="field-label">Cible personnelle (FCFA)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  disabled={!fundsEd.editing}
                  value={fundsTarget}
                  onChange={(e) => fundsEd.set({ fundsTarget: Number(e.target.value) || 0 })}
                  className="input mono text-right text-[16px] font-semibold"
                />
                {fundsEd.editing && cadRate ? (
                  <span className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] text-muted">
                    ou en $ CA
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={toCad(fundsTarget) || ""}
                      onChange={(e) => fundsEd.set({ fundsTarget: Math.round((Number(e.target.value) || 0) * cadRate) })}
                      aria-label="Cible personnelle, en dollars canadiens"
                      className="input mono w-28 py-1 text-right text-[13px]"
                    />
                  </span>
                ) : (
                  inCad(fundsTarget) && <span className="mono mt-1 block text-right text-[12px] text-muted">{inCad(fundsTarget)}</span>
                )}
              </label>
            </div>
            {fundsInvalid && (
              <p role="alert" className="mt-3 text-[12.5px] font-semibold text-bad">
                {fundsInvalid}
              </p>
            )}
            {fundsEd.editing && cadRate && <p className="mt-2 text-[11.5px] text-faint">Le barème IRCC est publié en dollars canadiens : saisissez le minimum en $ CA : il reste fixé en dollars et son équivalent FCFA suit le taux ({rateNote}). Saisi en FCFA, il ne bouge plus.</p>}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Goal reached={progress.minReached} label="Minimum exigé" rest={toMin} months={monthsToMin} />
              <Goal reached={progress.targetReached} label="Cible" rest={toTarget} months={monthsToTarget} />
            </div>
          </section>
          <aside className="card self-start p-4 sm:p-5">
            <p className="text-[13px] font-bold">Bon à savoir</p>
            <ul className="mt-3 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-muted">
              <li>Le minimum suit le barème IRCC des fonds d&apos;établissement : mettez-le à jour chaque année.</li>
              <li>Les fonds doivent être disponibles et justifiés par des relevés bancaires récents.</li>
              {cadRate && (
                <li>
                  Épargné : <span className="mono font-semibold text-ink">{inCad(progress.saved)}</span> {rateNote}. IRCC exige le montant en dollars canadiens : gardez une marge pour le change.
                </li>
              )}
              <li>La projection en mois se base sur votre moyenne mensuelle ({fcfa(avg)} F).</li>
            </ul>
          </aside>
        </div>
      )}
      </div>
    </>
  );
}

/** « Novembre 2026 » → « nov. 26 » ; les autres libellés sont tronqués. */
function shortLabel(label: string): string {
  const m = /^(\p{L}+)\s+(\d{4})$/u.exec(label.trim());
  if (m) return `${m[1].slice(0, 3).toLowerCase()}. ${m[2].slice(2)}`;
  return label.trim().split(/\s+/)[0] ?? "";
}

function Goal({ reached, label, rest, months }: { reached: boolean; label: string; rest: number; months: number | null }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${reached ? "border-ok/30 bg-ok-bg" : "border-line"}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${reached ? "bg-ok text-surface" : "bg-surface-2 text-muted"}`}>
        {reached ? <IconCheck size={14} strokeWidth={3} /> : <IconPiggy size={14} />}
      </span>
      <span className="text-[13px]">
        <span className="block font-semibold">{label}</span>
        <span className={reached ? "text-ok" : "text-muted"}>{reached ? "atteint" : <>encore <span className="mono">{fcfa(rest)} F</span>{months != null && <> · ≈ {months} mois, vers {monthsFromNow(months)}</>}</>}</span>
      </span>
    </div>
  );
}
