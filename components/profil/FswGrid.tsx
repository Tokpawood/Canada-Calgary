"use client";

import { useMemo, type ReactNode } from "react";
import { EDU_LEVELS, FSW_PASS_THRESHOLD, fswCalc } from "@/lib/rules";
import type { FirstLanguage, FswProfile, HistoryEntry } from "@/lib/types";
import { Chip, Meter, type Tone } from "@/components/ui";

const TESTS: Array<["co" | "ce" | "eo" | "ee", string, string]> = [
  ["co", "CO", "Compréhension orale"],
  ["ce", "CE", "Compréhension écrite"],
  ["eo", "EO", "Expression orale"],
  ["ee", "EE", "Expression écrite"],
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
  editing: boolean;
  actions?: ReactNode;
}

export function FswGrid({ fsw, naissance, profileDate, history, onChange, editing, actions }: Props) {
  const off = !editing;
  const r = useMemo(() => fswCalc(fsw, naissance, profileDate, history), [fsw, naissance, profileDate, history]);
  const second = other(fsw.first);
  const statusTone: Tone = r.status === "Admissible" ? "ok" : r.status === "À compléter" ? "todo" : "bad";

  const factors: Array<{ label: string; value: number; max: number; hint?: string }> = [
    { label: "Langue première", value: r.l1, max: 24, hint: r.known ? undefined : "scores à saisir" },
    { label: "Deuxième langue", value: r.l2, max: 4, hint: "NCLC 5 partout" },
    { label: "Études", value: r.ed, max: 25, hint: r.eduSet ? undefined : "évaluation WES à faire" },
    { label: "Expérience", value: r.ex, max: 15 },
    { label: "Âge", value: r.ag, max: 12 },
    { label: "Offre d'emploi", value: r.ae, max: 10 },
    { label: "Adaptabilité", value: r.ad, max: 10 },
  ];

  return (
    <section className={`card p-4 sm:p-5 ${editing ? "ring-2 ring-act-soft" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold">Grille des travailleurs qualifiés</h2>
          <p className="text-[12.5px] text-muted">Admissibilité au programme fédéral (Entrée express) · seuil {FSW_PASS_THRESHOLD} / 100</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={statusTone} dot>
            {r.status}
          </Chip>
          {actions}
        </div>
      </div>
      {editing && <p className="mt-2 text-[12px] text-muted">Le score se met à jour pendant la saisie ; il n&apos;est enregistré qu&apos;au clic sur « Enregistrer ».</p>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div>
          <p className="font-display text-[52px] leading-none font-extrabold tracking-tight">
            {r.total}
            <span className="ml-1 text-lg font-semibold text-muted">/ 100</span>
          </p>
          <p className={`mt-1.5 text-[13px] font-semibold ${r.margin >= 0 ? "text-ok" : "text-bad"}`}>
            {r.margin >= 0 ? `${r.margin} point(s) au-dessus du seuil` : `${-r.margin} point(s) sous le seuil`}
          </p>
          <Meter className="mt-4" value={r.total} tone={r.margin >= 0 ? "ok" : "act"} height={8} label="Score total" markers={[{ pct: FSW_PASS_THRESHOLD, label: `Seuil ${FSW_PASS_THRESHOLD}` }]} />
          <div className="mono relative mt-1.5 h-4 text-[10.5px] text-faint">
            <span className="absolute left-0">0</span>
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${FSW_PASS_THRESHOLD}%` }}>
              seuil {FSW_PASS_THRESHOLD}
            </span>
            <span className="absolute right-0">100</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5">
          {factors.map((f) => (
            <li key={f.label} className="grid grid-cols-[120px_minmax(0,1fr)_56px] items-center gap-3 text-[13px]">
              <span className="truncate font-medium">{f.label}</span>
              <span className="flex items-center gap-2">
                <Meter value={(f.value / f.max) * 100} height={5} className="flex-1" label={f.label} />
                {f.hint && <span className="hidden text-[11px] whitespace-nowrap text-faint sm:inline">{f.hint}</span>}
              </span>
              <span className="mono text-right text-muted">
                <span className="font-semibold text-ink">{f.value}</span>/{f.max}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="field-label mb-0">Langue première</span>
            <select disabled={off} value={fsw.first} onChange={(e) => onChange({ first: e.target.value as FirstLanguage })} className="input w-auto py-1 text-[13px]" aria-label="Langue première">
              <option value="fr">Français (TCF / TEF)</option>
              <option value="en">Anglais (IELTS / CELPIP)</option>
            </select>
          </div>
          <ScoreInputs lang={fsw.first} fsw={fsw} onChange={onChange} disabled={off} />
        </div>
        <div>
          <span className="field-label">Deuxième langue officielle ({second === "fr" ? "français" : "anglais"})</span>
          <ScoreInputs lang={second} fsw={fsw} onChange={onChange} disabled={off} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label>
          <span className="field-label">Études (équivalence canadienne)</span>
          <select disabled={off} value={fsw.edu} onChange={(e) => onChange({ edu: e.target.value })} className="input">
            {EDU_LEVELS.map((e) => (
              <option key={e.code} value={e.code}>
                {e.label} ({e.points})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Offre d&apos;emploi réservé</span>
          <select disabled={off} value={fsw.arranged} onChange={(e) => onChange({ arranged: e.target.value as FswProfile["arranged"] })} className="input">
            <option value="0">Non (0 pt)</option>
            <option value="10">Oui (10 pts)</option>
          </select>
        </label>
        <label>
          <span className="field-label">Capacité d&apos;adaptation</span>
          <select disabled={off} value={fsw.adapt} onChange={(e) => onChange({ adapt: e.target.value as FswProfile["adapt"] })} className="input">
            <option value="0">0 pt</option>
            <option value="5">5 pts</option>
            <option value="10">10 pts</option>
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-xl bg-surface-2/70 p-3.5">
        <p className="text-[12.5px] font-semibold">Simulation</p>
        <p className="text-[12px] text-muted">Total obtenu selon le niveau NCLC atteint dans chaque épreuve de la langue première, autres facteurs inchangés{r.eduSet ? "" : " (études supposées : postsecondaire deux ans)"}.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[320px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="py-1.5 font-medium">NCLC</th>
                <th className="py-1.5 text-right font-medium">Sans 2e langue</th>
                <th className="py-1.5 text-right font-medium">Avec 2e langue</th>
              </tr>
            </thead>
            <tbody>
              {[7, 8, 9].map((level) => {
                const without = r.simulation.find((s) => s.level === level && !s.withSecond)?.total ?? 0;
                const withSecond = r.simulation.find((s) => s.level === level && s.withSecond)?.total ?? 0;
                return (
                  <tr key={level} className="border-t border-line">
                    <td className="mono py-1.5 font-semibold">{level}+</td>
                    <SimCell total={without} />
                    <SimCell total={withSecond} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SimCell({ total }: { total: number }) {
  const pass = total >= FSW_PASS_THRESHOLD;
  return (
    <td className="py-1.5 text-right">
      <span className={`mono font-semibold ${pass ? "text-ok" : "text-bad"}`}>{total}</span>
      <span className="ml-1.5 text-[11px] text-faint">{pass ? "admissible" : "insuffisant"}</span>
    </td>
  );
}

function ScoreInputs({ lang, fsw, onChange, disabled }: { lang: FirstLanguage; fsw: FswProfile; onChange: (patch: Partial<FswProfile>) => void; disabled: boolean }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      {TESTS.map(([k, short, label]) => {
        const key = `${lang}_${k}` as const;
        const v = fsw[key];
        const low = v !== "" && Number(v) < 7;
        return (
          <label key={k} title={label}>
            <span className="mb-1 block text-center text-[11px] font-semibold text-muted">{short}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={12}
              value={v}
              disabled={disabled}
              placeholder="—"
              aria-label={`${label} (${lang === "fr" ? "français" : "anglais"}), niveau NCLC`}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<FswProfile>)}
              className={`input mono text-center text-[15px] font-semibold ${low ? "border-bad text-bad" : ""}`}
            />
          </label>
        );
      })}
    </div>
  );
}
