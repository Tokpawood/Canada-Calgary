"use client";

import { useMemo } from "react";
import { EDU_LEVELS, FSW_PASS_THRESHOLD, fswCalc } from "@/lib/rules";
import type { FirstLanguage, FswProfile, HistoryEntry } from "@/lib/types";

const TESTS: Array<["co" | "ce" | "eo" | "ee", string]> = [
  ["co", "Compréhension orale"],
  ["ce", "Compréhension écrite"],
  ["eo", "Expression orale"],
  ["ee", "Expression écrite"],
];

function other(lang: FirstLanguage): FirstLanguage {
  return lang === "fr" ? "en" : "fr";
}

interface Props {
  fsw: FswProfile;
  naissance: string | null;
  profileDate: string | null;
  history: HistoryEntry[];
  onChange: (patch: Partial<FswProfile>) => void;
}

export function FswGrid({ fsw, naissance, profileDate, history, onChange }: Props) {
  const result = useMemo(() => fswCalc(fsw, naissance, profileDate, history), [fsw, naissance, profileDate, history]);
  const second = other(fsw.first);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">Grille des travailleurs qualifiés (Entrée express)</h3>
        <StatusBadge result={result} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted">
            Langue première
            <select
              value={fsw.first}
              onChange={(e) => onChange({ first: e.target.value as FirstLanguage })}
              className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm"
            >
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TESTS.map(([k, label]) => (
              <label key={k} className="text-xs text-muted">
                {label}
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={fsw[`${fsw.first}_${k}`]}
                  onChange={(e) => onChange({ [`${fsw.first}_${k}`]: e.target.value } as Partial<FswProfile>)}
                  className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
                />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Points 1re langue : {result.l1}/24</p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted">Deuxième langue officielle ({second === "fr" ? "français" : "anglais"})</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TESTS.map(([k, label]) => (
              <label key={k} className="text-xs text-muted">
                {label}
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={fsw[`${second}_${k}`]}
                  onChange={(e) => onChange({ [`${second}_${k}`]: e.target.value } as Partial<FswProfile>)}
                  className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
                />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Points 2e langue : {result.l2}/4</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="text-xs font-medium text-muted">
          Études
          <select value={fsw.edu} onChange={(e) => onChange({ edu: e.target.value })} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm">
            {EDU_LEVELS.map((e) => (
              <option key={e.code} value={e.code}>
                {e.label} ({e.points})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Offre d&apos;emploi réservé
          <select value={fsw.arranged} onChange={(e) => onChange({ arranged: e.target.value as FswProfile["arranged"] })} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm">
            <option value="0">Non (0 pt)</option>
            <option value="10">Oui (10 pts)</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Capacité d&apos;adaptation
          <select value={fsw.adapt} onChange={(e) => onChange({ adapt: e.target.value as FswProfile["adapt"] })} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm">
            <option value="0">0 pt</option>
            <option value="5">5 pts</option>
            <option value="10">10 pts</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Point label="Langue 1" value={result.l1} />
        <Point label="Langue 2" value={result.l2} />
        <Point label="Études" value={result.ed} />
        <Point label="Expérience" value={result.ex} />
        <Point label="Âge" value={result.ag} />
        <Point label="Offre + adapt." value={result.ae + result.ad} />
      </div>
      <p className="mt-3 font-display text-2xl font-bold">
        {result.total} <span className="text-sm font-medium text-muted">/ {FSW_PASS_THRESHOLD} requis</span>
      </p>

      <div className="mt-4 overflow-x-auto">
        <p className="mb-1 text-xs font-medium text-muted">Simulation (études et expérience inchangées)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1">Niveau 1re langue</th>
              <th className="py-1">Sans 2e langue</th>
              <th className="py-1">Avec 2e langue</th>
            </tr>
          </thead>
          <tbody>
            {[7, 8, 9].map((level) => {
              const without = result.simulation.find((s) => s.level === level && !s.withSecond);
              const withSecond = result.simulation.find((s) => s.level === level && s.withSecond);
              return (
                <tr key={level} className="border-t border-line">
                  <td className="py-1 font-mono">{level}+</td>
                  <td className="py-1 font-mono">{without?.total}</td>
                  <td className="py-1 font-mono">{withSecond?.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Point({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2 text-center">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-mono text-base font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ result }: { result: ReturnType<typeof fswCalc> }) {
  const style =
    result.status === "Admissible" ? "bg-ok-bg text-ok" : result.status === "À compléter" ? "bg-todo-bg text-todo" : "bg-bad-bg text-bad";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${style}`}>{result.status}</span>;
}
