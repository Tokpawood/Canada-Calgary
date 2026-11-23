"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PROCEDURE_GOAL,
  TAB_ROLE,
  type Procedure,
  type ProcedureTab,
} from "@/lib/procedure";
import { IconChevronDown } from "@/components/icons";

const TAB_LABEL: Record<ProcedureTab, string> = {
  parcours: "Parcours",
  documents: "Documents",
  budget: "Budget",
  epargne: "Épargne",
  profil: "Profil",
  contacts: "Contacts",
  coffre: "Coffre",
};

const DOT = { hi: "bg-bad", md: "bg-signal", lo: "bg-faint" } as const;

const fmtMonth = (iso: string | null) => {
  if (!iso) return "";
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
};

/**
 * Bandeau commun aux onglets du dossier : un seul objectif (la RP par Entrée express), les 5 phases,
 * ce que l'onglet apporte et ce qu'il reste à y régler pour la phase en cours et la suivante.
 */
export function ProcedureBanner({
  procedure,
  tab,
}: {
  procedure: Procedure;
  tab: ProcedureTab;
}) {
  const [open, setOpen] = useState(false);
  const cur = procedure.phases[procedure.current - 1];
  const mine = procedure.alerts.filter((a) => a.tab === tab);
  const elsewhere = Object.entries(
    procedure.alerts
      .filter((a) => a.tab !== tab && a.level === "hi")
      .reduce<Record<string, number>>(
        (m, a) => ((m[a.tab] = (m[a.tab] ?? 0) + 1), m),
        {},
      ),
  ) as Array<[ProcedureTab, number]>;

  return (
    <section
      className="card mb-5 overflow-hidden"
      aria-label="Objectif de la procédure"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3.5 pb-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Objectif commun
          </p>
          <p className="text-[14.5px] font-bold">{PROCEDURE_GOAL.title}</p>
          <p className="text-[12px] text-muted">{PROCEDURE_GOAL.sub}</p>
        </div>
        <ol
          className="flex w-full items-end gap-1 sm:w-auto"
          aria-label="Phases de la procédure"
        >
          {procedure.phases.map((p) => (
            <li
              key={p.n}
              className="min-w-0 flex-1 sm:w-16 sm:flex-none"
              title={`${p.n}. ${p.title} : ${p.done}/${p.total} étapes`}
            >
              <span
                className={`block text-center text-[10.5px] font-semibold ${p.state === "en-cours" ? "text-ink" : "text-muted"}`}
              >
                {p.state === "fait" ? "✓" : p.n}
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={`block h-full rounded-full ${p.state === "fait" ? "bg-ok" : p.state === "en-cours" ? "bg-signal" : "bg-faint/50"}`}
                  style={{
                    width: `${p.total ? Math.max(p.state === "en-cours" ? 8 : 0, (p.done / p.total) * 100) : 0}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t border-line px-4 py-3 sm:px-5">
        <p className="text-[13px]">
          <span className="font-semibold">
            Phase {cur.n} en cours : {cur.title}
          </span>
          <span className="text-muted">
            {" "}
            · {cur.done}/{cur.total} étapes
            {cur.to ? ` · jusqu'à ${fmtMonth(cur.to)}` : ""}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted">{cur.goal}</p>
        <p className="mt-2 text-[12.5px]">
          <span className="font-semibold">{TAB_LABEL[tab]} · </span>
          <span className="text-muted">{TAB_ROLE[tab]}</span>
        </p>
        {mine.length > 0 && (
          <ul className="mt-2 space-y-1">
            {mine.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                <span
                  className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[a.level]}`}
                  aria-hidden
                />
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        )}
        {elsewhere.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
            <span className="text-muted">À régler ailleurs :</span>
            {elsewhere.map(([t, n]) => (
              <Link
                key={t}
                href={`/${t}`}
                className="rounded-full bg-bad/10 px-2 py-0.5 font-semibold text-bad hover:bg-bad/15"
              >
                {TAB_LABEL[t]} ({n})
              </Link>
            ))}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-ink"
        >
          <IconChevronDown
            size={13}
            className={`transition-transform ${open ? "" : "-rotate-90"}`}
          />
          {open ? "Masquer les 5 phases" : "Voir les 5 phases"}
        </button>
        {open && (
          <ol className="mt-2 grid gap-2 sm:grid-cols-5">
            {procedure.phases.map((p) => (
              <li
                key={p.n}
                className={`rounded-xl border px-3 py-2 ${p.state === "en-cours" ? "border-signal/60 bg-signal/5" : "border-line"}`}
              >
                <p className="text-[12px] font-bold">
                  {p.state === "fait" ? "✓ " : `${p.n}. `}
                  {p.title}
                </p>
                <p className="mono text-[11px] text-muted">
                  {p.done}/{p.total} étapes
                  {p.from ? ` · ${fmtMonth(p.from)} → ${fmtMonth(p.to)}` : ""}
                </p>
                <p className="mt-1 text-[11.5px] text-muted">{p.goal}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
