"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorEntry } from "@/lib/formation";
import {
  KIND_LABEL,
  QUIZ_SOURCES,
  SOURCE_LABEL,
  progressOf,
  type ItemResult,
  type PublicQuizItem,
  type Quiz,
  type QuizSource,
} from "@/lib/quiz";
import { splitBlanks, wordDiff } from "@/lib/wordDiff";
import {
  IconAlert,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconGauge,
  IconPencil,
  IconRefresh,
  IconX,
} from "@/components/icons";
import { fmtDay } from "./shared";

// ---------------------------------------------------------------------------
// Petits utilitaires

const DRAFT_KEY = (id: string) => `pcc-quiz-${id}`;
const VIEW_KEY = "pcc-quiz-view";

function readStore<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writeStore(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* stockage indisponible : simple confort perdu */
  }
}

const SOURCE_DOT: Record<QuizSource, string> = {
  carnet: "bg-signal",
  "aide-memoire": "bg-ink",
  cours: "bg-faint",
};
const SOURCE_SHORT: Record<QuizSource, string> = {
  carnet: "Carnet",
  "aide-memoire": "Aide-mémoire",
  cours: "Cours",
};
const tone = (pct: number) => (pct >= 80 ? "ok" : pct >= 50 ? "signal" : "bad");
const TONE_TEXT = {
  ok: "text-ok",
  signal: "text-opt",
  bad: "text-bad",
} as const;
const TONE_BAR = { ok: "bg-ok", signal: "bg-signal", bad: "bg-bad" } as const;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Horloge pour le chronomètre d'attente (appelée seulement depuis des gestionnaires d'événements). */
const clockNow = () => Date.now();

/** Jours d'affilée avec une série corrigée (aujourd'hui compris s'il est fait, sinon à partir d'hier). */
function streakOf(quizzes: Quiz[], today: string): number {
  const done = new Set(
    quizzes.filter((q) => q.status === "corrige").map((q) => q.day),
  );
  const prev = (d: string) => {
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() - 1);
    return x.toISOString().slice(0, 10);
  };
  let d = done.has(today) ? today : prev(today);
  let n = 0;
  while (done.has(d)) {
    n++;
    d = prev(d);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Éléments visuels

function Ring({
  value,
  max,
  size = 92,
  label,
  neutral = false,
}: {
  value: number;
  max: number;
  size?: number;
  label?: string;
  neutral?: boolean;
}) {
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const t = tone(pct * 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${value} sur ${max}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={7}
        />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={
              neutral
                ? "var(--ink)"
                : t === "ok"
                  ? "var(--ok)"
                  : t === "signal"
                    ? "var(--signal)"
                    : "var(--bad)"
            }
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            style={{ transition: "stroke-dasharray .6s ease" }}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="mono text-[22px] font-bold">{value}</span>
        <span className="mono text-[11px] text-muted">/{max}</span>
      </span>
    </div>
  );
}

function SourceChip({ source }: { source: QuizSource }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-muted">
      <span
        className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[source]}`}
        aria-hidden
      />
      {SOURCE_SHORT[source]}
    </span>
  );
}

function Mark({ score }: { score: number }) {
  if (score >= 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-semibold text-ok">
        <IconCheck size={13} /> Juste
      </span>
    );
  if (score > 0)
    return (
      <span className="rounded-full bg-opt-bg px-2 py-0.5 text-[12px] font-semibold text-opt">
        ½ Partiel
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bad-bg px-2 py-0.5 text-[12px] font-semibold text-bad">
      <IconX size={13} /> À revoir
    </span>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="rounded-xl border-l-4 border-signal bg-surface-2 px-4 py-3 text-[15.5px] leading-relaxed whitespace-pre-line">
      {children}
    </blockquote>
  );
}

// ---------------------------------------------------------------------------
// Saisie des réponses

function BlankSentence({
  item,
  value,
  onChange,
  disabled,
  onEnter,
}: {
  item: PublicQuizItem;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  onEnter?: () => void;
}) {
  const parts = splitBlanks(item.prompt);
  const n = parts.length - 1;
  if (n < 1)
    return (
      <>
        <Quote>{item.prompt}</Quote>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="input text-[15px]"
          placeholder="Votre réponse"
          aria-label="Votre réponse"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </>
    );
  const vals =
    n === 1
      ? [value]
      : Array.from({ length: n }, (_, i) => (value.split("/")[i] ?? "").trim());
  const set = (i: number, v: string) => {
    if (n === 1) return onChange(v);
    const next = [...vals];
    next[i] = v.replace(/\//g, "");
    onChange(next.every((x) => !x.trim()) ? "" : next.join(" / "));
  };
  return (
    <p className="rounded-xl bg-surface-2 px-4 py-4 text-[16px] leading-[2.4]">
      {parts.map((p, i) => (
        <Fragment key={i}>
          <span className="whitespace-pre-line">{p}</span>
          {i < n && (
            <input
              value={vals[i]}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnter?.();
                }
              }}
              disabled={disabled}
              aria-label={n === 1 ? "Mot manquant" : `Blanc ${i + 1} sur ${n}`}
              placeholder={n === 1 ? "…" : `${i + 1}`}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="mx-1 inline-block rounded-lg border-0 border-b-2 border-ink bg-surface px-2 py-0.5 text-center font-semibold text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/40"
              style={{ width: `${Math.max(5, (vals[i]?.length ?? 0) + 2)}ch` }}
            />
          )}
        </Fragment>
      ))}
    </p>
  );
}

function AnswerField({
  item,
  value,
  onChange,
  disabled,
  onEnter,
}: {
  item: PublicQuizItem;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  onEnter?: () => void;
}) {
  if (item.kind === "qcm")
    return (
      <>
        <Quote>{item.prompt}</Quote>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Choix de réponse"
        >
          {item.options.map((o, i) => {
            const on = value === o;
            return (
              <label
                key={o}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-3 text-[15px] transition-colors ${on ? "border-ink bg-act-soft" : "border-line hover:border-muted"} ${disabled ? "cursor-default opacity-70" : ""}`}
              >
                <input
                  type="radio"
                  name={item.id}
                  checked={on}
                  onChange={() => onChange(o)}
                  disabled={disabled}
                  className="sr-only"
                />
                <span
                  className={`mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${on ? "bg-ink text-surface" : "bg-surface-2 text-muted"}`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      </>
    );
  if (item.kind === "trou")
    return (
      <BlankSentence
        item={item}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onEnter={onEnter}
      />
    );
  const n = words(value);
  return (
    <>
      {item.kind === "production" ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-line">
          {item.prompt}
        </p>
      ) : (
        <Quote>{item.prompt}</Quote>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={item.kind === "production" ? 6 : 3}
        className="input text-[15px] leading-relaxed"
        placeholder={
          item.kind === "correction"
            ? "Réécrivez la phrase corrigée"
            : item.kind === "reformulation"
              ? "Votre reformulation"
              : "Votre texte"
        }
        aria-label="Votre réponse"
        spellCheck={false}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
        {item.kind === "correction" && !disabled ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange(item.prompt)}
          >
            <IconPencil size={13} /> Partir de la phrase d&apos;origine
          </button>
        ) : (
          <span />
        )}
        <span className="mono">
          {n} mot{n > 1 ? "s" : ""}
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exercice corrigé

function DiffText({
  from,
  to,
  side,
}: {
  from: string;
  to: string;
  side: "answer" | "fix";
}) {
  const parts = useMemo(() => wordDiff(from, to), [from, to]);
  return (
    <>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : (side === "answer" && p.type === "del") ||
          (side === "fix" && p.type === "add") ? (
          <Fragment key={i}>
            <span
              className={
                p.type === "del"
                  ? "rounded bg-bad/15 px-0.5 text-bad line-through decoration-2"
                  : "rounded bg-ok/15 px-0.5 font-semibold text-ok"
              }
            >
              {p.text.trimEnd()}
            </span>
            {p.text.slice(p.text.trimEnd().length)}
          </Fragment>
        ) : null,
      )}
    </>
  );
}

function CorrectedItem({
  item,
  n,
  answer,
  result,
}: {
  item: PublicQuizItem;
  n: number;
  answer: string;
  result: ItemResult | undefined;
}) {
  const ok = !!result && result.score >= 1;
  const fix = result?.corrected || item.accepted?.[0] || "";
  const diff = !ok && item.kind !== "qcm" && !!answer.trim() && !!fix;
  return (
    <li
      className={`card overflow-hidden ${ok ? "" : "border-l-4"} ${result && !ok ? (result.score > 0 ? "border-l-signal" : "border-l-bad") : ""}`}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            <span className="mono font-bold text-ink">
              {String(n).padStart(2, "0")}
            </span>
            <span className="font-semibold text-ink">
              {KIND_LABEL[item.kind]}
            </span>
            <span>· {item.skill}</span>
            <SourceChip source={item.source} />
          </div>
          {result && <Mark score={result.score} />}
        </div>
        <p className="text-[14.5px] leading-relaxed whitespace-pre-line">
          {item.prompt}
        </p>
        <div className="grid gap-2 text-[14px] sm:grid-cols-2">
          <div
            className={`rounded-xl px-3 py-2.5 ${ok ? "bg-ok-bg" : "bg-surface-2"}`}
          >
            <p className="eyebrow mb-1">Votre réponse</p>
            <p className="leading-relaxed whitespace-pre-line">
              {diff ? (
                <DiffText from={answer} to={fix} side="answer" />
              ) : (
                answer.trim() || (
                  <span className="text-muted">Pas de réponse</span>
                )
              )}
            </p>
          </div>
          {!ok && fix && (
            <div className="rounded-xl bg-ok-bg px-3 py-2.5">
              <p className="eyebrow mb-1 !text-ok">Correction</p>
              <p className="leading-relaxed whitespace-pre-line">
                {diff ? <DiffText from={answer} to={fix} side="fix" /> : fix}
              </p>
            </div>
          )}
        </div>
        {result?.feedback && !ok && (
          <p className="text-[14px] leading-relaxed">{result.feedback}</p>
        )}
        {item.explanation && (
          <p className="flex gap-2 rounded-xl border border-line px-3 py-2.5 text-[13.5px] leading-relaxed">
            <IconBook size={15} className="mt-0.5 shrink-0 text-muted" />
            <span>
              <span className="font-semibold">{item.topic} — </span>
              {item.explanation}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Progrès

function Progress({ quizzes, today }: { quizzes: Quiz[]; today: string }) {
  const p = useMemo(() => progressOf(quizzes, today), [quizzes, today]);
  const streak = useMemo(() => streakOf(quizzes, today), [quizzes, today]);
  const series = useMemo(
    () =>
      quizzes
        .filter((q) => q.status === "corrige" && q.score != null)
        .slice(0, 14)
        .reverse()
        .map((q) => ({
          day: q.day,
          pct: Math.round((q.score! / q.total) * 100),
          label: `${q.score}/${q.total}`,
        })),
    [quizzes],
  );
  if (!p.done) return null;
  const trend = p.last7 != null && p.prev7 != null ? p.last7 - p.prev7 : null;
  const weak = p.byTopic.filter((t) => t.n >= 2 && t.rate < 75).slice(0, 6);
  const strong = p.byTopic.filter((t) => t.n >= 2 && t.rate >= 90).slice(-6);
  return (
    <section
      className="card flex flex-col gap-5 p-4 sm:p-6"
      aria-labelledby="quiz-progress"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id="quiz-progress"
          className="flex items-center gap-2 font-display text-[17px] font-bold"
        >
          <IconGauge size={17} /> Vos progrès
        </h3>
        <span className="text-[12px] text-muted">
          {p.done} série{p.done > 1 ? "s" : ""} corrigée{p.done > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Moyenne",
            value: p.average == null ? "—" : `${p.average} %`,
          },
          {
            label: "7 derniers jours",
            value: p.last7 == null ? "—" : `${p.last7} %`,
          },
          {
            label: "Évolution",
            value: trend == null ? "—" : `${trend > 0 ? "+" : ""}${trend} pts`,
            sub:
              trend == null
                ? "visible après 2 semaines"
                : "vs semaine précédente",
            cls: trend == null ? "" : trend >= 0 ? "text-ok" : "text-bad",
          },
          {
            label: "Série en cours",
            value: `${streak} j`,
            sub: streak ? "jours d'affilée" : "reprenez aujourd'hui",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-3">
            <p className="eyebrow">{s.label}</p>
            <p className={`mono mt-1 text-[22px] font-bold ${s.cls ?? ""}`}>
              {s.value}
            </p>
            {s.sub && <p className="text-[11px] text-muted">{s.sub}</p>}
          </div>
        ))}
      </div>

      {series.length > 1 && (
        <figure>
          <figcaption className="eyebrow mb-2">
            Score des dernières séries (%)
          </figcaption>
          <div className="relative h-28">
            <div
              className="absolute inset-x-0 top-0 border-t border-dashed border-line"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 top-1/2 border-t border-dashed border-line"
              aria-hidden
            />
            <span className="mono absolute -top-2 right-0 bg-surface pl-1 text-[10px] text-faint">
              100
            </span>
            <span className="mono absolute top-[calc(50%-0.5rem)] right-0 bg-surface pl-1 text-[10px] text-faint">
              50
            </span>
            <ol className="absolute inset-0 flex items-end gap-[2px] pr-7">
              {series.map((s, i) => (
                <li
                  key={s.day}
                  className="group relative flex h-full flex-1 items-end"
                  aria-label={`${fmtDay(s.day, { day: "numeric", month: "short" })} : ${s.label}`}
                >
                  <span
                    className={`mx-auto block w-full max-w-9 rounded-t-[4px] ${i === series.length - 1 ? "bg-signal" : "bg-ink/80"}`}
                    style={{ height: `${Math.max(3, s.pct)}%` }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-night px-2 py-1 text-[11px] whitespace-nowrap text-night-ink opacity-0 transition-opacity group-hover:opacity-100">
                    {fmtDay(s.day, { day: "numeric", month: "short" })} ·{" "}
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mono mt-1 flex justify-between pr-7 text-[10.5px] text-faint">
            <span>
              {fmtDay(series[0].day, { day: "numeric", month: "short" })}
            </span>
            <span>
              {fmtDay(series[series.length - 1].day, {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </figure>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">Par épreuve</p>
          <ul className="flex flex-col gap-2.5">
            {p.bySkill.map((s) => (
              <li key={s.skill} className="text-[13.5px]">
                <div className="flex justify-between gap-2">
                  <span>{s.skill}</span>
                  <span className="mono text-muted">
                    {s.rate} % <span className="text-faint">· {s.n}</span>
                  </span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full ${TONE_BAR[tone(s.rate)]}`}
                    style={{ width: `${Math.max(4, s.rate)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4 text-[13px]">
          <div>
            <p className="eyebrow mb-2">À revoir en priorité</p>
            {weak.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {weak.map((t) => (
                  <li
                    key={t.topic}
                    className="rounded-full bg-bad-bg px-2.5 py-1 text-bad"
                  >
                    {t.topic} <span className="mono">· {t.rate} %</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                Rien de récurrent pour l&apos;instant.
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow mb-2">Acquis</p>
            {strong.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {strong.map((t) => (
                  <li
                    key={t.topic}
                    className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-1 text-ok"
                  >
                    <IconCheck size={12} /> {t.topic}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                Une règle est acquise après au moins deux réussites.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Écran principal

export function QuizView({
  quizzes,
  setQuizzes,
  setErrors,
  today,
  canEdit,
}: {
  quizzes: Quiz[];
  setQuizzes: (f: (q: Quiz[]) => Quiz[]) => void;
  setErrors: (f: (e: ErrorEntry[]) => ErrorEntry[]) => void;
  today: string;
  canEdit: boolean;
}) {
  const current = quizzes.find((q) => q.day === today) ?? null;
  const past = quizzes.filter((q) => q.day !== today);
  // L'onglet n'est jamais rendu côté serveur : lire le stockage ici ne crée pas d'écart d'hydratation.
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    current?.status === "pret" ? readStore(DRAFT_KEY(current.id), {}) : {},
  );
  const [view, setView] = useState<"focus" | "list">(() =>
    readStore(VIEW_KEY, "focus"),
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<"prepare" | "grade" | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [openPast, setOpenPast] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (current?.status === "pret") writeStore(DRAFT_KEY(current.id), answers);
  }, [answers, current?.id, current?.status]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(clockNow()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const setMode = (v: "focus" | "list") => {
    setView(v);
    writeStore(VIEW_KEY, v);
  };
  const goTo = (i: number) => {
    setStep(i);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function prepare() {
    setBusy("prepare");
    setError(null);
    const t0 = clockNow();
    setStartedAt(t0);
    setNow(t0);
    const show = (quiz: Quiz) =>
      setQuizzes((list) => [quiz, ...list.filter((q) => q.id !== quiz.id)]);
    // La préparation peut durer plusieurs minutes et la réponse se perdre en route (veille de l'iPad,
    // réseau) : en parallèle, on vérifie toutes les 15 s si la série est déjà enregistrée.
    let settled = false;
    const poll = async () => {
      const deadline = Date.now() + 6 * 60_000;
      while (!settled && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 15_000));
        if (settled) return null;
        try {
          const res = await fetch("/api/formation/quiz", { cache: "no-store" });
          const json = (await res.json().catch(() => ({}))) as {
            quiz?: Quiz | null;
          };
          if (res.ok && json.quiz) return json.quiz;
        } catch {
          /* réseau momentanément indisponible : on réessaie au tour suivant */
        }
      }
      return null;
    };
    const post = (async () => {
      const res = await fetch("/api/formation/quiz", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        quiz?: Quiz;
        error?: string;
      };
      if (!res.ok || !json.quiz)
        throw new Error(
          json.error ?? "La série n'a pas pu être préparée. Réessayez.",
        );
      return json.quiz;
    })();
    try {
      const quiz = await Promise.race([post, poll().then((q) => q ?? post)]);
      setStep(0);
      show(quiz);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "La série n'a pas pu être préparée.",
      );
    } finally {
      settled = true;
      setBusy(null);
    }
  }

  async function grade() {
    if (!current) return;
    setBusy("grade");
    setError(null);
    const t0 = clockNow();
    setStartedAt(t0);
    setNow(t0);
    let settled = false;
    // Même filet que pour la préparation : si la réponse se perd, on retrouve la série corrigée en base.
    const poll = async (): Promise<{
      quiz: Quiz;
      bumped?: string[];
    } | null> => {
      const deadline = Date.now() + 6 * 60_000;
      while (!settled && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 15_000));
        if (settled) return null;
        try {
          const res = await fetch("/api/formation/quiz", { cache: "no-store" });
          const json = (await res.json().catch(() => ({}))) as {
            quiz?: Quiz | null;
          };
          if (
            res.ok &&
            json.quiz?.id === current.id &&
            json.quiz.status === "corrige"
          )
            return { quiz: json.quiz };
        } catch {
          /* on réessaie au tour suivant */
        }
      }
      return null;
    };
    const post = (async () => {
      const res = await fetch(
        `/api/formation/quiz/${encodeURIComponent(current.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        quiz?: Quiz;
        bumped?: string[];
        error?: string;
      };
      if (!res.ok || !json.quiz)
        throw new Error(json.error ?? "La correction a échoué. Réessayez.");
      return { quiz: json.quiz, bumped: json.bumped };
    })();
    try {
      const json = await Promise.race([post, poll().then((q) => q ?? post)]);
      setQuizzes((list) =>
        list.map((q) => (q.id === json.quiz.id ? json.quiz : q)),
      );
      if (json.bumped?.length) {
        const ids = new Set(json.bumped);
        setErrors((list) =>
          list.map((e) =>
            ids.has(e.id)
              ? { ...e, count: Math.min(999, e.count + 1), mastered: false }
              : e,
          ),
        );
      }
      try {
        localStorage.removeItem(DRAFT_KEY(current.id));
      } catch {
        /* rien à nettoyer */
      }
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "La correction a échoué.");
    } finally {
      settled = true;
      setBusy(null);
    }
  }

  const elapsed = busy ? Math.max(0, now - startedAt) : 0;
  const filled = (id: string) => !!(answers[id] ?? "").trim();
  const answered = current
    ? current.items.filter((it) => filled(it.id)).length
    : 0;
  const locked = busy !== null || !canEdit;

  // ----- Avant la série -----
  const intro = (
    <section className="card overflow-hidden">
      <div className="bg-night px-5 py-6 text-night-ink sm:px-7">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          Série du {fmtDay(today)}
        </p>
        <h3 className="mt-1 font-display text-[22px] font-bold">
          10 exercices, environ 15 minutes
        </h3>
        <p className="mt-1.5 max-w-xl text-[13.5px] text-night-muted">
          Claude relit votre carnet d&apos;erreurs, votre aide-mémoire et le
          cours des semaines commencées, puis prépare une série sur ce que vous
          devez consolider. Il la corrige ensuite et suit vos progrès.
        </p>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-3">
        {QUIZ_SOURCES.map((s) => (
          <div
            key={s}
            className="flex items-center gap-3 bg-surface px-5 py-3.5"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${SOURCE_DOT[s]}`}
              aria-hidden
            />
            <span className="text-[13.5px]">
              <span className="font-semibold">{SOURCE_LABEL[s]}</span>
              <span className="mono ml-1.5 text-muted">
                ~{s === "carnet" ? 4 : 3}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-[12.5px] text-muted">
          Choix multiples · textes à trous · phrases à corriger · reformulations
          · courte production écrite
        </p>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary shrink-0 px-5 py-2.5"
            onClick={() => void prepare()}
            disabled={busy !== null}
          >
            {busy === "prepare" ? (
              <>
                <IconRefresh size={16} className="animate-spin" /> Préparation…{" "}
                <span className="mono">{fmtClock(elapsed)}</span>
              </>
            ) : (
              <>
                Préparer la série du jour <IconArrowRight size={16} />
              </>
            )}
          </button>
        ) : (
          <p className="text-[13px] text-muted">
            Seul le titulaire du dossier peut lancer la série.
          </p>
        )}
      </div>
      {busy === "prepare" && (
        <p className="border-t border-line bg-surface-2 px-5 py-3 text-[12.5px] text-muted sm:px-7">
          Claude rédige vos exercices. Cela peut prendre 3 à 5 minutes : vous
          pouvez laisser la page ouverte en arrière-plan, la série
          s&apos;affichera dès qu&apos;elle sera prête.
        </p>
      )}
    </section>
  );

  // ----- Pendant la série -----
  const doing = current?.status === "pret" && (
    <>
      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Ring
            neutral
            value={answered}
            max={current.items.length}
            size={72}
            label={`${answered} réponses sur ${current.items.length}`}
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Série du {fmtDay(today)}</p>
            <h3 className="mt-0.5 font-display text-[18px] leading-snug font-bold">
              {current.title || "Exercices du jour"}
            </h3>
            {current.focus && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {current.focus}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Exercices" className="flex flex-wrap gap-1.5">
            {current.items.map((it, i) => {
              const on = view === "focus" && i === step;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() =>
                    view === "focus"
                      ? goTo(i)
                      : document
                          .getElementById(`ex-${it.id}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          })
                  }
                  aria-current={on ? "step" : undefined}
                  aria-label={`Exercice ${i + 1}${filled(it.id) ? " (répondu)" : ""}`}
                  className={`mono h-8 w-8 rounded-lg text-[12.5px] font-bold transition-colors ${on ? "bg-signal text-night ring-2 ring-signal/40" : filled(it.id) ? "bg-ink text-surface" : "bg-surface-2 text-muted hover:text-ink"}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>
          <div
            className="flex rounded-lg border border-line p-0.5 text-[12px]"
            role="group"
            aria-label="Affichage"
          >
            {(["focus", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2.5 py-1 font-semibold ${view === v ? "bg-ink text-surface" : "text-muted"}`}
              >
                {v === "focus" ? "Un par un" : "Tout voir"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(view === "focus"
        ? [current.items[Math.min(step, current.items.length - 1)]]
        : current.items
      ).map((it) => {
        const i = current.items.indexOf(it);
        const last = i === current.items.length - 1;
        return (
          <article
            key={it.id}
            id={`ex-${it.id}`}
            className="card flex flex-col gap-4 p-5 sm:p-7"
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[26px] leading-none font-bold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mono text-[12px] text-faint">
                  / {current.items.length}
                </span>
                <span className="ml-1 text-[13px] font-semibold">
                  {KIND_LABEL[it.kind]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted">
                  {it.skill}
                </span>
                <SourceChip source={it.source} />
              </div>
            </header>
            <p className="text-[13.5px] font-medium text-muted">
              {it.instruction}
            </p>
            <AnswerField
              item={it}
              value={answers[it.id] ?? ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [it.id]: v }))}
              disabled={locked}
              onEnter={
                view === "focus" && !last ? () => goTo(i + 1) : undefined
              }
            />
            {view === "focus" && (
              <footer className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => goTo(i - 1)}
                  disabled={i === 0}
                >
                  <IconChevronLeft size={16} /> Précédent
                </button>
                {!last ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => goTo(i + 1)}
                  >
                    {filled(it.id) ? "Suivant" : "Passer"}{" "}
                    <IconChevronRight size={16} />
                  </button>
                ) : (
                  canEdit && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void grade()}
                      disabled={busy !== null}
                    >
                      Corriger la série <IconCheck size={16} />
                    </button>
                  )
                )}
              </footer>
            )}
          </article>
        );
      })}

      {canEdit &&
        (view === "list" ||
          busy === "grade" ||
          answered === current.items.length) && (
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-night px-4 py-3 text-night-ink shadow-lg">
            <span className="text-[13px]">
              {busy === "grade" ? (
                <>
                  Claude corrige vos réponses…{" "}
                  <span className="mono text-night-muted">
                    {fmtClock(elapsed)}
                  </span>
                </>
              ) : (
                <>
                  <span className="mono font-bold">{answered}</span>
                  <span className="text-night-muted">
                    /{current.items.length} réponses
                  </span>
                  {answered < current.items.length && (
                    <span className="text-night-muted">
                      {" "}
                      · les blancs comptent faux
                    </span>
                  )}
                </>
              )}
            </span>
            <button
              type="button"
              className="btn bg-signal text-night hover:brightness-110"
              onClick={() => void grade()}
              disabled={busy !== null}
            >
              {busy === "grade" ? (
                <IconRefresh size={16} className="animate-spin" />
              ) : (
                <IconCheck size={16} />
              )}{" "}
              Corriger la série
            </button>
          </div>
        )}
    </>
  );

  // ----- Après correction -----
  const results = current?.status === "corrige" ? current : null;
  const bySource = useMemo(() => {
    if (!results?.results) return [];
    return QUIZ_SOURCES.map((s) => {
      const its = results.items.filter((it) => it.source === s);
      const got = its.reduce(
        (sum, it) =>
          sum + (results.results!.find((r) => r.id === it.id)?.score ?? 0),
        0,
      );
      return { source: s, got, n: its.length };
    }).filter((x) => x.n);
  }, [results]);
  const missed = results
    ? results.items.filter(
        (it) => (results.results?.find((r) => r.id === it.id)?.score ?? 0) < 1,
      )
    : [];
  const done = results && (
    <>
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <Ring
            value={results.score ?? 0}
            max={results.total}
            size={112}
            label={`Score ${results.score} sur ${results.total}`}
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Série du {fmtDay(today)} · corrigée</p>
            <h3 className="mt-0.5 font-display text-[20px] leading-snug font-bold">
              {results.title}
            </h3>
            {results.summary && (
              <p className="mt-2 text-[14.5px] leading-relaxed">
                {results.summary}
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
          {bySource.map((s) => {
            const pct = Math.round((s.got / s.n) * 100);
            return (
              <div key={s.source} className="bg-surface px-5 py-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${SOURCE_DOT[s.source]}`}
                      aria-hidden
                    />
                    {SOURCE_SHORT[s.source]}
                  </span>
                  <span className={`mono font-bold ${TONE_TEXT[tone(pct)]}`}>
                    {s.got}/{s.n}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full ${TONE_BAR[tone(pct)]}`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="border-t border-line bg-surface-2 px-5 py-2.5 text-[12.5px] text-muted sm:px-7">
          Prochaine série demain. Les fautes du carnet ratées aujourd&apos;hui
          reviendront en priorité.
        </p>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold">Correction détaillée</h3>
        {missed.length > 0 && missed.length < results.items.length && (
          <div
            className="flex rounded-lg border border-line p-0.5 text-[12px]"
            role="group"
            aria-label="Filtre"
          >
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setOnlyMissed(v)}
                aria-pressed={onlyMissed === v}
                className={`rounded-md px-2.5 py-1 font-semibold ${onlyMissed === v ? "bg-ink text-surface" : "text-muted"}`}
              >
                {v ? `À revoir (${missed.length})` : "Tout"}
              </button>
            ))}
          </div>
        )}
      </div>
      <ol className="no-stagger flex flex-col gap-3">
        {results.items.map((it, i) =>
          onlyMissed && !missed.includes(it) ? null : (
            <CorrectedItem
              key={it.id}
              item={it}
              n={i + 1}
              answer={results.answers?.[it.id] ?? ""}
              result={results.results?.find((r) => r.id === it.id)}
            />
          ),
        )}
      </ol>
    </>
  );

  return (
    <div ref={topRef} className="flex scroll-mt-4 flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-bad-bg px-4 py-3 text-[13.5px] text-bad"
        >
          <IconAlert size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {!current ? intro : current.status === "pret" ? doing : done}

      <Progress quizzes={quizzes} today={today} />

      {past.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="quiz-history">
          <h3 id="quiz-history" className="text-[15px] font-bold">
            Séries précédentes
          </h3>
          <div className="card divide-y divide-line overflow-hidden">
            {past.map((q) => {
              const pct =
                q.score == null ? null : Math.round((q.score / q.total) * 100);
              const open = openPast === q.id;
              return (
                <article key={q.id}>
                  <button
                    type="button"
                    onClick={() => setOpenPast(open ? null : q.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60"
                  >
                    <span
                      className={`mono flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold ${pct == null ? "bg-surface-2 text-muted" : pct >= 80 ? "bg-ok-bg text-ok" : pct >= 50 ? "bg-opt-bg text-opt" : "bg-bad-bg text-bad"}`}
                    >
                      {q.score == null ? "—" : `${q.score}/${q.total}`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {q.title || "Série"}
                      </span>
                      <span className="block text-[12px] text-muted first-letter:uppercase">
                        {fmtDay(q.day)}
                        {q.status === "pret" ? " · non corrigée" : ""}
                      </span>
                    </span>
                    <IconChevronDown
                      size={18}
                      className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-line bg-surface-2/40 p-3">
                      {q.status === "corrige" ? (
                        <>
                          {q.summary && (
                            <p className="mb-3 px-1 text-[13.5px] leading-relaxed">
                              {q.summary}
                            </p>
                          )}
                          <ol className="flex flex-col gap-3">
                            {q.items.map((it, i) => (
                              <CorrectedItem
                                key={it.id}
                                item={it}
                                n={i + 1}
                                answer={q.answers?.[it.id] ?? ""}
                                result={q.results?.find((r) => r.id === it.id)}
                              />
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="px-2 py-1 text-[13px] text-muted">
                          Cette série n&apos;a pas été corrigée le jour même.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
