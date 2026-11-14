"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dossier } from "@/lib/types";
import { Chip, Meter, PageHeader, dueInfo, fcfa } from "@/components/ui";
import { EditBar, useEditable } from "@/components/editable";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";
import { IconCalendar, IconGlobe, IconRoute, IconWallet } from "@/components/icons";

interface Props {
  dossier: Dossier;
  rows: Array<{ phase: string; planned: number; actual: number }>;
  upcoming: Array<{ id: string; title: string; due: string | null; planned: number; phase: string }>;
}

const TABS = ["phases", "a-payer", "conversion"] as const;
type Tab = (typeof TABS)[number];

const shortPhase = (p: string) => p.replace(/^\d+\.\s*/, "");

export function BudgetBoard({ dossier, rows, upcoming }: Props) {
  const [savedRate, setSavedRate] = useState(dossier.cadRate);
  const [tab, setTab] = useHashTab<Tab>(TABS, "phases");
  const [convert, setConvert] = useState("");
  const supabase = createClient();
  const rateEd = useEditable({ rate: savedRate }, async (d) => {
    const { error } = await supabase.from("dossier").update({ cad_rate: d.rate }).eq("id", dossier.id);
    if (error) throw error;
    setSavedRate(d.rate);
  });
  const cadRate = rateEd.current.rate;

  const totalPlanned = rows.reduce((sum, r) => sum + r.planned, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const remaining = Math.max(0, totalPlanned - totalActual);
  const paidPct = totalPlanned ? (totalActual / totalPlanned) * 100 : 0;
  const upcomingTotal = upcoming.reduce((s, u) => s + u.planned, 0);
  const soon = upcoming.filter((u) => {
    const d = dueInfo(u.due, true);
    return d && (d.tone === "bad" || d.tone === "opt");
  });
  const overPhases = rows.filter((r) => r.planned > 0 && r.actual > r.planned).length;

  const cadNum = (n: number) => (savedRate > 0 ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n / savedRate) : "—");
  const cad = (n: number) => (savedRate > 0 ? `≈ ${cadNum(n)} $ CA` : "—");

  const convertValue = Number(convert.replace(/\s/g, "").replace(",", "."));

  return (
    <>
      <PageHeader title="Budget" description="Frais prévus et payés pour chaque phase du parcours, d'après les coûts saisis dans les étapes." />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              { label: "Reste à payer", value: fcfa(remaining), unit: "F", sub: cad(remaining) },
              {
                label: "Prochaines dépenses",
                value: String(upcoming.length),
                sub: upcoming.length ? `${fcfa(upcomingTotal)} F en attente` : "rien en attente",
                tone: soon.length ? "bad" : undefined,
              },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Sections du budget"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "phases", label: "Par phase", icon: <IconRoute size={15} />, badge: overPhases ? { text: String(overPhases), tone: "bad" } : null },
              { id: "a-payer", label: "À payer", icon: <IconCalendar size={15} />, badge: upcoming.length ? { text: String(upcoming.length), tone: soon.length ? "signal" : "plain" } : null },
              { id: "conversion", label: "Conversion", icon: <IconGlobe size={15} />, dirty: rateEd.editing },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Déjà payé</p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {fcfa(totalActual)}
          <span className="ml-1.5 text-[22px] text-signal">F</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          sur <span className="mono text-night-ink">{fcfa(totalPlanned)} F</span> prévus · {cad(totalActual)}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, paidPct)}%` }} />
          </div>
          <span className="mono text-[13px] font-semibold">{Math.round(paidPct)} %</span>
        </div>
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
        {tab === "phases" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => {
                const pct = r.planned > 0 ? (r.actual / r.planned) * 100 : 0;
                const over = r.actual > r.planned && r.planned > 0;
                const share = totalPlanned ? (r.planned / totalPlanned) * 100 : 0;
                return (
                  <article key={r.phase} className="card flex flex-col p-4">
                    <div className="flex items-center gap-3">
                      <span className="mono grid h-8 w-8 shrink-0 place-items-center rounded-full bg-act-soft text-[13px] font-bold text-act">{i + 1}</span>
                      <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-bold" title={r.phase}>
                        {shortPhase(r.phase)}
                      </h3>
                      <span className="mono text-[11.5px] text-muted" title="Part du budget total">
                        {Math.round(share)} %
                      </span>
                    </div>
                    <p className="mono mt-3 text-[20px] leading-none font-semibold">
                      {fcfa(r.actual)}
                      <span className="text-[12px] font-medium text-muted"> / {fcfa(r.planned)} F</span>
                    </p>
                    {r.planned > 0 ? (
                      <Meter className="mt-3" value={pct} tone={over ? "bad" : pct >= 100 ? "ok" : "act"} height={5} label={`Phase ${r.phase}, part payée`} />
                    ) : (
                      <p className="mt-3 text-[12px] text-faint">aucun coût prévu</p>
                    )}
                    <p className={`mt-2 text-[12px] ${over ? "font-semibold text-bad" : "text-muted"}`}>
                      {over ? `Dépassement de ${fcfa(r.actual - r.planned)} F` : r.planned ? `Reste ${fcfa(Math.max(0, r.planned - r.actual))} F · ${cad(Math.max(0, r.planned - r.actual))}` : " "}
                    </p>
                  </article>
                );
              })}
            </div>

            <section className="card overflow-hidden">
              <div className="px-4 pt-4 pb-2 sm:px-5">
                <h2 className="text-[16px] font-bold">Détail en FCFA</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11.5px] text-muted">
                      <th className="px-4 py-2 font-medium sm:px-5">Phase</th>
                      <th className="px-3 py-2 text-right font-medium">Prévu</th>
                      <th className="px-3 py-2 text-right font-medium">Payé</th>
                      <th className="px-3 py-2 text-right font-medium">Reste</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-5">En $ CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const over = r.actual > r.planned && r.planned > 0;
                      return (
                        <tr key={r.phase} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                          <td className="px-4 py-2.5 font-semibold sm:px-5">
                            <span className="mono mr-2 text-muted">{i + 1}.</span>
                            {shortPhase(r.phase)}
                          </td>
                          <td className="mono px-3 py-2.5 text-right">{fcfa(r.planned)}</td>
                          <td className="mono px-3 py-2.5 text-right">{fcfa(r.actual)}</td>
                          <td className={`mono px-3 py-2.5 text-right ${over ? "text-bad" : "text-muted"}`}>
                            {over ? `+${fcfa(r.actual - r.planned)}` : fcfa(Math.max(0, r.planned - r.actual))}
                          </td>
                          <td className="mono px-4 py-2.5 text-right text-muted sm:px-5">{cadNum(r.planned)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-surface-2/60 font-bold">
                      <td className="px-4 py-3 sm:px-5">Total</td>
                      <td className="mono px-3 py-3 text-right">{fcfa(totalPlanned)}</td>
                      <td className="mono px-3 py-3 text-right">{fcfa(totalActual)}</td>
                      <td className="mono px-3 py-3 text-right">{fcfa(remaining)}</td>
                      <td className="mono px-4 py-3 text-right sm:px-5">{cadNum(totalPlanned)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === "a-payer" && (
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
              <div>
                <h2 className="text-[16px] font-bold">Dépenses à venir</h2>
                <p className="text-[12.5px] text-muted">Étapes ouvertes avec un coût prévu et pas encore payé, par échéance.</p>
              </div>
              <div className="text-right">
                <p className="mono text-[18px] font-semibold">{fcfa(upcomingTotal)} F</p>
                <p className="text-[11.5px] text-muted">{cad(upcomingTotal)}</p>
              </div>
            </div>
            {upcoming.length === 0 ? (
              <p className="border-t border-line px-4 py-8 text-center text-[13px] text-muted">Aucune dépense prévue en attente de paiement.</p>
            ) : (
              <ul>
                {upcoming.map((u) => {
                  const due = dueInfo(u.due, true);
                  return (
                    <li key={u.id} className="flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                        <IconWallet size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{u.title}</span>
                        <span className="block truncate text-[12px] text-muted">{shortPhase(u.phase)}</span>
                      </span>
                      {due && (
                        <Chip tone={due.tone} className="mono hidden sm:inline-flex">
                          {due.text}
                        </Chip>
                      )}
                      <span className="w-28 shrink-0 text-right">
                        <span className="mono block text-[13.5px] font-semibold">{fcfa(u.planned)} F</span>
                        <span className="mono block text-[11px] text-faint">{cadNum(u.planned)} $</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "conversion" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className={`card p-4 sm:p-6 ${rateEd.editing ? "ring-2 ring-act-soft" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold">Taux de conversion</h2>
                  <p className="text-[12.5px] text-muted">Utilisé pour toutes les estimations en dollars canadiens.</p>
                </div>
                <EditBar edit={rateEd} />
              </div>
              <label className="mt-5 flex items-center gap-3 text-[15px]">
                <span className="font-semibold">1 $ CA =</span>
                <input
                  type="number"
                  inputMode="numeric"
                  disabled={!rateEd.editing}
                  value={cadRate}
                  onChange={(e) => rateEd.set({ rate: Number(e.target.value) || 0 })}
                  aria-label="Taux de conversion, en francs CFA pour un dollar canadien"
                  className="input mono w-32 text-right text-[18px] font-semibold"
                />
                <span className="font-semibold">FCFA</span>
              </label>
              <p className="mt-4 text-[12px] text-faint">Vérifiez le taux avant chaque paiement important : il varie selon la banque et le jour.</p>
            </section>

            <section className="card p-4 sm:p-6">
              <h2 className="text-[16px] font-bold">Convertisseur</h2>
              <p className="text-[12.5px] text-muted">Saisissez un montant en francs CFA.</p>
              <div className="mt-5 grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <label>
                  <span className="field-label">FCFA</span>
                  <input value={convert} onChange={(e) => setConvert(e.target.value)} inputMode="numeric" placeholder="Ex. 250 000" className="input mono text-right" />
                </label>
                <span className="hidden pt-5 text-faint sm:block">→</span>
                <div>
                  <span className="field-label">Dollars canadiens</span>
                  <p className="mono rounded-xl bg-surface-2 px-3 py-2 text-right text-[15px] font-semibold">
                    {convert && Number.isFinite(convertValue) && savedRate > 0 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(convertValue / savedRate)} $` : "—"}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
                {[
                  { label: "Prévu", v: totalPlanned },
                  { label: "Payé", v: totalActual },
                  { label: "Reste", v: remaining },
                ].map((x) => (
                  <div key={x.label}>
                    <dt className="text-[11.5px] text-muted">{x.label}</dt>
                    <dd className="mono m-0 mt-0.5 text-[14px] font-semibold">{cadNum(x.v)} $</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
