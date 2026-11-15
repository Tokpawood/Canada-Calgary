"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dossier } from "@/lib/types";
import {
  Chip,
  EmptyState,
  Meter,
  PageHeader,
  dueInfo,
  fcfa,
} from "@/components/ui";
import { EditBar, useEditable } from "@/components/editable";
import {
  DarkHeader,
  DarkTiles,
  HeaderTabs,
  useHashTab,
} from "@/components/DarkHeader";
import {
  IconCalendar,
  IconGlobe,
  IconRoute,
  IconWallet,
} from "@/components/icons";
import type { Rates } from "@/lib/currency";
import { bankMarginPct, budgetTotals, overdueTotal, rateError } from "@/lib/budget";
import { Converter } from "./Converter";

interface Props {
  dossier: Dossier;
  rows: Array<{ phase: string; planned: number; actual: number }>;
  upcoming: Array<{
    id: string;
    title: string;
    due: string | null;
    planned: number;
    phase: string;
  }>;
  /** Taux du jour (BCE), ou null si indisponible. */
  rates: Rates | null;
}

const TABS = ["phases", "a-payer", "conversion"] as const;
type Tab = (typeof TABS)[number];

const shortPhase = (p: string) => p.replace(/^\d+\.\s*/, "");

export function BudgetBoard({ dossier, rows, upcoming, rates }: Props) {
  const [savedRate, setSavedRate] = useState(dossier.cadRate);
  const [tab, setTab] = useHashTab<Tab>(TABS, "phases");
  const supabase = createClient();
  const rateEd = useEditable(
    { rate: savedRate },
    async (d) => {
      const invalid = rateError(d.rate);
      if (invalid) throw new Error(invalid);
      const { error } = await supabase
        .from("dossier")
        .update({ cad_rate: d.rate })
        .eq("id", dossier.id);
      if (error) throw error;
      setSavedRate(d.rate);
    },
    (d) => rateError(d.rate),
  );
  const cadRate = rateEd.current.rate;

  const {
    planned: totalPlanned,
    actual: totalActual,
    remaining,
  } = budgetTotals(rows);
  const paidPct = totalPlanned ? (totalActual / totalPlanned) * 100 : 0;
  const upcomingTotal = upcoming.reduce((s, u) => s + u.planned, 0);
  const soon = upcoming.filter((u) => {
    const d = dueInfo(u.due, true);
    return d && (d.tone === "bad" || d.tone === "opt");
  });
  const overPhases = rows.filter(
    (r) => r.planned > 0 && r.actual > r.planned,
  ).length;

  // Estimations en dollars canadiens : taux du jour s'il est disponible, sinon le taux enregistré.
  const liveCad = rates?.perXof.CAD ?? null;
  const estRate = liveCad ?? savedRate;
  const cadNum = (n: number) =>
    estRate > 0
      ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
          n / estRate,
        )
      : "—";
  const cad = (n: number) => (estRate > 0 ? `≈ ${cadNum(n)} $ CA` : "—");
  const rateDate = rates
    ? new Date(`${rates.date}T12:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })
    : null;
  const fmt2 = (n: number) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
  const margin = bankMarginPct(cadRate, liveCad);
  const rateInvalid = rateEd.editing ? rateError(cadRate) : null;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const overdue = overdueTotal(upcoming, todayIso);
  const presets = [
    { label: "Reste à payer", xof: remaining },
    { label: "Dépenses à venir", xof: upcomingTotal },
    { label: "Budget total", xof: totalPlanned },
  ].filter((p) => p.xof > 0);

  return (
    <>
      <PageHeader
        title="Budget"
        description="Frais prévus et payés pour chaque phase du parcours, d'après les coûts saisis dans les étapes."
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              {
                label: "Reste à payer",
                value: fcfa(remaining),
                unit: "F",
                sub: cad(remaining),
              },
              {
                label: "Prochaines dépenses",
                value: String(upcoming.length),
                sub: upcoming.length
                  ? `${fcfa(upcomingTotal)} F en attente`
                  : "rien en attente",
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
              {
                id: "phases",
                label: "Par phase",
                icon: <IconRoute size={15} />,
                badge: overPhases
                  ? { text: String(overPhases), tone: "bad" }
                  : null,
              },
              {
                id: "a-payer",
                label: "À payer",
                icon: <IconCalendar size={15} />,
                badge: upcoming.length
                  ? {
                      text: String(upcoming.length),
                      tone: soon.length ? "signal" : "plain",
                    }
                  : null,
              },
              {
                id: "conversion",
                label: "Conversion",
                icon: <IconGlobe size={15} />,
                dirty: rateEd.editing,
              },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          Déjà payé
        </p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {fcfa(totalActual)}
          <span className="ml-1.5 text-[22px] text-signal">F</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          sur{" "}
          <span className="mono text-night-ink">{fcfa(totalPlanned)} F</span>{" "}
          prévus · {cad(totalActual)}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-signal"
              style={{ width: `${Math.min(100, paidPct)}%` }}
            />
          </div>
          <span className="mono text-[13px] font-semibold">
            {Math.round(paidPct)} %
          </span>
        </div>
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
        {tab === "phases" && rows.length === 0 && (
          <EmptyState icon={<IconWallet size={20} />} title="Aucun coût saisi">
            Renseignez le coût prévu des étapes dans l&apos;onglet Parcours : le
            budget par phase se construit automatiquement.
          </EmptyState>
        )}

        {tab === "phases" && rows.length > 0 && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => {
                const pct = r.planned > 0 ? (r.actual / r.planned) * 100 : 0;
                const over = r.actual > r.planned && r.planned > 0;
                const share = totalPlanned
                  ? (r.planned / totalPlanned) * 100
                  : 0;
                return (
                  <article key={r.phase} className="card flex flex-col p-4">
                    <div className="flex items-center gap-3">
                      <span className="mono grid h-8 w-8 shrink-0 place-items-center rounded-full bg-act-soft text-[13px] font-bold text-act">
                        {i + 1}
                      </span>
                      <h3
                        className="min-w-0 flex-1 truncate text-[14.5px] font-bold"
                        title={r.phase}
                      >
                        {shortPhase(r.phase)}
                      </h3>
                      <span
                        className="mono text-[11.5px] text-muted"
                        title="Part du budget total"
                      >
                        {Math.round(share)} %
                      </span>
                    </div>
                    <p className="mono mt-3 text-[20px] leading-none font-semibold">
                      {fcfa(r.actual)}
                      <span className="text-[12px] font-medium text-muted">
                        {" "}
                        / {fcfa(r.planned)} F
                      </span>
                    </p>
                    {r.planned > 0 ? (
                      <Meter
                        className="mt-3"
                        value={pct}
                        tone={over ? "bad" : pct >= 100 ? "ok" : "act"}
                        height={5}
                        label={`Phase ${r.phase}, part payée`}
                      />
                    ) : (
                      <p className="mt-3 text-[12px] text-faint">
                        aucun coût prévu
                      </p>
                    )}
                    <p
                      className={`mt-2 text-[12px] ${over ? "font-semibold text-bad" : "text-muted"}`}
                    >
                      {over
                        ? `Dépassement de ${fcfa(r.actual - r.planned)} F`
                        : r.planned
                          ? `Reste ${fcfa(Math.max(0, r.planned - r.actual))} F · ${cad(Math.max(0, r.planned - r.actual))}`
                          : " "}
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
                      <th className="px-3 py-2 text-right font-medium">
                        Prévu
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Payé</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Reste
                      </th>
                      <th className="px-4 py-2 text-right font-medium sm:px-5">
                        En $ CA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const over = r.actual > r.planned && r.planned > 0;
                      return (
                        <tr
                          key={r.phase}
                          className="border-b border-line last:border-0 hover:bg-surface-2/60"
                        >
                          <td className="px-4 py-2.5 font-semibold sm:px-5">
                            <span className="mono mr-2 text-muted">
                              {i + 1}.
                            </span>
                            {shortPhase(r.phase)}
                          </td>
                          <td className="mono px-3 py-2.5 text-right">
                            {fcfa(r.planned)}
                          </td>
                          <td className="mono px-3 py-2.5 text-right">
                            {fcfa(r.actual)}
                          </td>
                          <td
                            className={`mono px-3 py-2.5 text-right ${over ? "text-bad" : "text-muted"}`}
                          >
                            {over
                              ? `+${fcfa(r.actual - r.planned)}`
                              : fcfa(Math.max(0, r.planned - r.actual))}
                          </td>
                          <td className="mono px-4 py-2.5 text-right text-muted sm:px-5">
                            {cadNum(r.planned)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-surface-2/60 font-bold">
                      <td className="px-4 py-3 sm:px-5">Total</td>
                      <td className="mono px-3 py-3 text-right">
                        {fcfa(totalPlanned)}
                      </td>
                      <td className="mono px-3 py-3 text-right">
                        {fcfa(totalActual)}
                      </td>
                      <td className="mono px-3 py-3 text-right">
                        {fcfa(remaining)}
                      </td>
                      <td className="mono px-4 py-3 text-right sm:px-5">
                        {cadNum(totalPlanned)}
                      </td>
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
                <p className="text-[12.5px] text-muted">
                  Étapes ouvertes avec un coût prévu et pas encore payé, par
                  échéance.
                </p>
              </div>
              <div className="text-right">
                <p className="mono text-[18px] font-semibold">
                  {fcfa(upcomingTotal)} F
                </p>
                <p className="text-[11.5px] text-muted">{cad(upcomingTotal)}</p>
                {overdue.count > 0 && (
                  <p className="mt-0.5 text-[11.5px] font-semibold text-bad">
                    dont <span className="mono">{fcfa(overdue.total)} F</span>{" "}
                    en retard ({overdue.count})
                  </p>
                )}
              </div>
            </div>
            {upcoming.length === 0 ? (
              <p className="border-t border-line px-4 py-8 text-center text-[13px] text-muted">
                Aucune dépense prévue en attente de paiement.
              </p>
            ) : (
              <ul>
                {upcoming.map((u) => {
                  const due = dueInfo(u.due, true);
                  return (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                        <IconWallet size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">
                          {u.title}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {shortPhase(u.phase)}
                          {due && (
                            <span
                              className={`sm:hidden ${due.tone === "bad" ? "font-semibold text-bad" : ""}`}
                            >
                              {" "}
                              · {due.text}
                            </span>
                          )}
                        </span>
                      </span>
                      {due && (
                        <Chip
                          tone={due.tone}
                          className="mono hidden sm:inline-flex"
                        >
                          {due.text}
                        </Chip>
                      )}
                      <span className="w-24 shrink-0 text-right sm:w-28">
                        <span className="mono block text-[13.5px] font-semibold">
                          {fcfa(u.planned)} F
                        </span>
                        <span className="mono block text-[11px] text-faint">
                          {cadNum(u.planned)} $
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "conversion" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section
              className={`card p-4 sm:p-6 ${rateEd.editing ? "ring-2 ring-act-soft" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold">Taux de conversion</h2>
                  <p className="text-[12.5px] text-muted">
                    {liveCad
                      ? "Les estimations en dollars canadiens suivent le taux du jour."
                      : "Taux du jour indisponible : les estimations utilisent votre taux enregistré."}
                  </p>
                </div>
                <EditBar edit={rateEd} label="Modifier mon taux" />
              </div>
              {rates && (
                <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3">
                  <p className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                    Taux du jour · {rateDate}
                  </p>
                  <dl className="mono mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[14px] sm:grid-cols-3">
                    {(["CAD", "EUR", "USD"] as const).map((c) => (
                      <div key={c} className="flex gap-1.5">
                        <dt className="text-muted">
                          1 {c === "CAD" ? "$ CA" : c === "EUR" ? "€" : "$ US"}{" "}
                          =
                        </dt>
                        <dd className="m-0 font-semibold">
                          {fmt2(rates.perXof[c])} F
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-1.5 text-[11.5px] text-faint">
                    Source : {rates.source}, mise à jour chaque jour ouvré. 1 €
                    = 655,957 FCFA (parité fixe).
                  </p>
                </div>
              )}
              <p className="mt-4 text-[12.5px] font-semibold text-muted">
                Mon taux (celui de ma banque)
              </p>
              <label className="mt-1.5 flex flex-wrap items-center gap-3 text-[15px]">
                <span className="font-semibold">1 $ CA =</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  disabled={!rateEd.editing}
                  value={cadRate || ""}
                  onChange={(e) =>
                    rateEd.set({ rate: Number(e.target.value) || 0 })
                  }
                  aria-label="Taux de conversion, en francs CFA pour un dollar canadien"
                  aria-invalid={rateInvalid ? true : undefined}
                  aria-describedby="budget-rate-help"
                  className={`input mono w-32 text-right text-[18px] font-semibold ${rateInvalid ? "border-bad" : ""}`}
                />
                <span className="font-semibold">FCFA</span>
                {rateEd.editing && liveCad && (
                  <button
                    type="button"
                    onClick={() =>
                      rateEd.set({ rate: Math.round(liveCad * 100) / 100 })
                    }
                    className="btn btn-sm btn-ghost"
                  >
                    Reprendre le taux du jour
                  </button>
                )}
              </label>
              <p
                id="budget-rate-help"
                className="mt-2 text-[12.5px]"
                aria-live="polite"
              >
                {rateInvalid ? (
                  <span className="font-semibold text-bad">{rateInvalid}</span>
                ) : margin != null ? (
                  <span className="text-muted">
                    {Math.abs(margin) < 0.05
                      ? "Identique au taux du jour."
                      : `${margin > 0 ? "Marge de" : "Écart de"} ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(margin)} % par rapport au taux du jour.`}
                  </span>
                ) : null}
              </p>
              <p className="mt-3 text-[12px] text-faint">
                Votre banque ajoute une marge au taux de référence : saisissez
                son taux pour estimer un virement au plus juste (« Mon taux »
                dans le convertisseur).
              </p>
            </section>

            <div className="flex flex-col gap-5">
              <Converter
                rates={rates}
                savedCadRate={savedRate}
                presets={presets}
              />
              <section className="card p-4 sm:p-6">
                <h2 className="text-[15px] font-bold">
                  Budget en dollars canadiens
                </h2>
                <p className="text-[12.5px] text-muted">
                  {liveCad
                    ? `Au taux du jour (${rateDate}).`
                    : "Au taux enregistré."}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "Prévu", v: totalPlanned },
                    { label: "Payé", v: totalActual },
                    { label: "Reste", v: remaining },
                  ].map((x) => (
                    <div key={x.label}>
                      <dt className="text-[11.5px] text-muted">{x.label}</dt>
                      <dd className="mono m-0 mt-0.5 text-[14px] font-semibold">
                        {cadNum(x.v)} $
                      </dd>
                      {liveCad &&
                        savedRate > 0 &&
                        Math.abs(savedRate - liveCad) >= 0.01 && (
                          <dd
                            className="mono m-0 text-[11.5px] text-muted"
                            title="Au taux enregistré (celui de ma banque)"
                          >
                            {new Intl.NumberFormat("fr-FR", {
                              maximumFractionDigits: 0,
                            }).format(x.v / savedRate)}{" "}
                            $ <span className="font-sans">banque</span>
                          </dd>
                        )}
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
