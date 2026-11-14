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

const LANG_LABEL: Record<FirstLanguage, string> = { fr: "Français · TCF / TEF", en: "Anglais · IELTS / CELPIP" };

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
  const r = useMemo(() => fswCalc(fsw, naissance, profileDate, history), [fsw, naissance, profileDate, history]);
  const second = other(fsw.first);
  const statusTone: Tone = r.status === "Admissible" ? "ok" : r.status === "À compléter" ? "todo" : "bad";
  const edu = EDU_LEVELS.find((e) => e.code === fsw.edu);

  const factors: Array<{ label: string; value: number; max: number; hint?: string }> = [
    { label: "Langue première", value: r.l1, max: 24, hint: r.known ? undefined : "scores à saisir" },
    { label: "Deuxième langue", value: r.l2, max: 4, hint: "NCLC 5 dans les 4 épreuves" },
    { label: "Études", value: r.ed, max: 25, hint: r.eduSet ? undefined : "évaluation WES à faire" },
    { label: "Expérience", value: r.ex, max: 15 },
    { label: "Âge", value: r.ag, max: 12 },
    { label: "Offre d'emploi", value: r.ae, max: 10 },
    { label: "Adaptabilité", value: r.ad, max: 10 },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Score */}
      <section className={`card p-5 sm:p-6 ${editing ? "ring-2 ring-act-soft" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold">Grille des travailleurs qualifiés</h2>
            <p className="text-[12.5px] text-muted">Admissibilité au programme fédéral (Entrée express) · il faut au moins {FSW_PASS_THRESHOLD} points sur 100.</p>
          </div>
          {actions}
        </div>
        {editing && <p className="mt-3 rounded-lg bg-act-soft px-3 py-2 text-[12.5px] text-act">Le score se recalcule pendant la saisie ; il n&apos;est enregistré qu&apos;au clic sur « Enregistrer ».</p>}

        <div className="mt-5 grid items-center gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col items-center">
            <ScoreRing total={r.total} pass={r.margin >= 0} />
            <Chip tone={statusTone} dot className="mt-3">
              {r.status}
            </Chip>
            <p className={`mt-1.5 text-[12.5px] font-semibold ${r.margin >= 0 ? "text-ok" : "text-muted"}`}>
              {r.margin >= 0 ? `${r.margin} point(s) au-dessus du seuil` : `${-r.margin} point(s) sous le seuil`}
            </p>
          </div>

          <ul className="flex flex-col divide-y divide-line">
            {factors.map((f) => (
              <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[140px_minmax(0,1fr)_64px]">
                <span className="text-[13.5px] font-semibold">
                  {f.label}
                  {f.hint && <span className="block text-[11.5px] font-normal text-faint sm:hidden">{f.hint}</span>}
                </span>
                <span className="col-span-2 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-auto">
                  <Meter value={(f.value / f.max) * 100} tone={f.value === f.max ? "ok" : "act"} height={6} className="flex-1" label={f.label} />
                  {f.hint && <span className="hidden w-40 shrink-0 truncate text-[11.5px] text-faint sm:block">{f.hint}</span>}
                </span>
                <span className="mono col-start-2 row-start-1 text-right text-[13px] text-muted sm:col-start-auto sm:row-start-auto">
                  <span className="font-semibold text-ink">{f.value}</span> / {f.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Langues */}
      <section className={`card p-5 sm:p-6 ${editing ? "ring-2 ring-act-soft" : ""}`}>
        <h3 className="text-[16px] font-bold">Résultats aux tests de langue</h3>
        <p className="text-[12.5px] text-muted">Niveau NCLC obtenu dans chaque épreuve. Il faut au moins NCLC 7 partout dans la langue première.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <LangPanel
            title="Langue première"
            lang={fsw.first}
            fsw={fsw}
            editing={editing}
            onChange={onChange}
            min={7}
            selector={
              editing ? (
                <select value={fsw.first} onChange={(e) => onChange({ first: e.target.value as FirstLanguage })} className="input w-auto py-1 text-[12.5px]" aria-label="Langue première">
                  <option value="fr">Français (TCF / TEF)</option>
                  <option value="en">Anglais (IELTS / CELPIP)</option>
                </select>
              ) : undefined
            }
          />
          <LangPanel title="Deuxième langue officielle" lang={second} fsw={fsw} editing={editing} onChange={onChange} min={5} />
        </div>
      </section>

      {/* Autres facteurs */}
      <section className={`card p-5 sm:p-6 ${editing ? "ring-2 ring-act-soft" : ""}`}>
        <h3 className="text-[16px] font-bold">Autres facteurs</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FactorTile label="Études (équivalence canadienne)" points={r.ed} max={25} value={edu ? edu.label : "Évaluation WES à faire"} muted={!r.eduSet}>
            {editing && (
              <select value={fsw.edu} onChange={(e) => onChange({ edu: e.target.value })} className="input" aria-label="Études">
                {EDU_LEVELS.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.label} ({e.points})
                  </option>
                ))}
              </select>
            )}
          </FactorTile>
          <FactorTile label="Offre d'emploi réservé" points={r.ae} max={10} value={fsw.arranged === "10" ? "Oui" : "Non"}>
            {editing && (
              <select value={fsw.arranged} onChange={(e) => onChange({ arranged: e.target.value as FswProfile["arranged"] })} className="input" aria-label="Offre d'emploi réservé">
                <option value="0">Non (0 pt)</option>
                <option value="10">Oui (10 pts)</option>
              </select>
            )}
          </FactorTile>
          <FactorTile label="Capacité d'adaptation" points={r.ad} max={10} value={`${fsw.adapt} point(s) déclaré(s)`}>
            {editing && (
              <select value={fsw.adapt} onChange={(e) => onChange({ adapt: e.target.value as FswProfile["adapt"] })} className="input" aria-label="Capacité d'adaptation">
                <option value="0">0 pt</option>
                <option value="5">5 pts</option>
                <option value="10">10 pts</option>
              </select>
            )}
          </FactorTile>
        </div>
      </section>

      {/* Simulation */}
      <section className="card p-5 sm:p-6">
        <h3 className="text-[16px] font-bold">Simulation</h3>
        <p className="text-[12.5px] text-muted">
          Score obtenu selon le niveau NCLC atteint dans toutes les épreuves de la langue première, autres facteurs inchangés
          {r.eduSet ? "" : " (études supposées : postsecondaire deux ans)"}.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[7, 8, 9].map((level) => {
            const without = r.simulation.find((s) => s.level === level && !s.withSecond)?.total ?? 0;
            const withSecond = r.simulation.find((s) => s.level === level && s.withSecond)?.total ?? 0;
            return (
              <div key={level} className="rounded-xl border border-line p-4">
                <p className="eyebrow">NCLC {level} et plus</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <SimValue total={without} label="sans 2ᵉ langue" />
                  <SimValue total={withSecond} label="avec 2ᵉ langue" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ScoreRing({ total, pass }: { total: number; pass: boolean }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(0, total));
  const tick = (FSW_PASS_THRESHOLD / 100) * 2 * Math.PI - Math.PI / 2;
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44" role="img" aria-label={`Score ${total} sur 100, seuil ${FSW_PASS_THRESHOLD}`}>
      <circle cx="80" cy="80" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
      <circle
        cx="80"
        cy="80"
        r={R}
        fill="none"
        stroke={pass ? "var(--ok)" : "var(--act)"}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * C} ${C}`}
        transform="rotate(-90 80 80)"
        style={{ transition: "stroke-dasharray .5s" }}
      />
      <line
        x1={80 + (R - 10) * Math.cos(tick)}
        y1={80 + (R - 10) * Math.sin(tick)}
        x2={80 + (R + 10) * Math.cos(tick)}
        y2={80 + (R + 10) * Math.sin(tick)}
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <title>{`Seuil ${FSW_PASS_THRESHOLD}`}</title>
      </line>
      <text x="80" y="82" textAnchor="middle" fontSize="40" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-mono)">
        {total}
      </text>
      <text x="80" y="104" textAnchor="middle" fontSize="12" fill="var(--muted)">
        sur 100 · seuil {FSW_PASS_THRESHOLD}
      </text>
    </svg>
  );
}

function LangPanel({
  title,
  lang,
  fsw,
  editing,
  onChange,
  min,
  selector,
}: {
  title: string;
  lang: FirstLanguage;
  fsw: FswProfile;
  editing: boolean;
  onChange: (patch: Partial<FswProfile>) => void;
  min: number;
  selector?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-bold">{title}</p>
          {!selector && <p className="text-[12px] text-muted">{LANG_LABEL[lang]}</p>}
        </div>
        {selector}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {TESTS.map(([k, short, label]) => {
          const key = `${lang}_${k}` as const;
          const v = fsw[key];
          const set = v !== "";
          const low = set && Number(v) < min;
          const tone = !set ? "border-dashed border-line text-faint" : low ? "border-bad/30 bg-bad-bg text-bad" : "border-ok/30 bg-ok-bg text-ok";
          return (
            <div key={k} title={label} className={`flex flex-col items-center rounded-lg border px-1 py-2.5 ${editing ? "border-line" : tone}`}>
              <span className="text-[11px] font-bold tracking-wider text-muted">{short}</span>
              {editing ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={12}
                  value={v}
                  placeholder="—"
                  aria-label={`${label} (${lang === "fr" ? "français" : "anglais"}), niveau NCLC`}
                  onChange={(e) => onChange({ [key]: e.target.value } as Partial<FswProfile>)}
                  className="input mono mt-1 px-1 text-center text-[16px] font-semibold"
                />
              ) : (
                <span className="mono mt-0.5 text-[22px] leading-tight font-bold">{set ? v : "—"}</span>
              )}
              <span className="mt-0.5 hidden text-center text-[10.5px] leading-tight text-faint sm:block">{label.replace("Compréhension", "Compr.").replace("Expression", "Expr.")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FactorTile({ label, points, max, value, muted = false, children }: { label: string; points: number; max: number; value: string; muted?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        <span className="mono shrink-0 text-[12px] text-muted">
          <span className="font-semibold text-ink">{points}</span>/{max}
        </span>
      </div>
      {children ?? <p className={`mt-1.5 text-[14.5px] font-semibold ${muted ? "text-opt" : ""}`}>{value}</p>}
      <div className="mt-auto pt-3">
        <Meter value={(points / max) * 100} tone={points === max ? "ok" : "act"} height={4} label={label} />
      </div>
    </div>
  );
}

function SimValue({ total, label }: { total: number; label: string }) {
  const pass = total >= FSW_PASS_THRESHOLD;
  return (
    <div>
      <p className={`mono text-[24px] leading-none font-bold ${pass ? "text-ok" : "text-bad"}`}>{total}</p>
      <p className="mt-1 text-[11.5px] text-muted">{label}</p>
      <p className={`text-[11px] font-semibold ${pass ? "text-ok" : "text-bad"}`}>{pass ? "admissible" : "insuffisant"}</p>
    </div>
  );
}
