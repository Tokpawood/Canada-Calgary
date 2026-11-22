"use client";

import { Fragment, useMemo, useState } from "react";
import type { ErrorEntry } from "@/lib/formation";
import {
  EPREUVE_LABEL,
  LEVELS,
  isComprehension,
  sectionQuestions,
  sectionTasks,
  type CeItem,
  type CoItem,
  type TcfTest,
} from "@/lib/tcf";
import { wordDiff } from "@/lib/wordDiff";
import {
  IconBook,
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconRefresh,
  IconX,
} from "@/components/icons";

export const LEVEL_TONE: Record<string, string> = {
  A1: "bg-bad-bg text-bad",
  A2: "bg-bad-bg text-bad",
  B1: "bg-opt-bg text-opt",
  B2: "bg-opt-bg text-opt",
  C1: "bg-ok-bg text-ok",
  C2: "bg-ok text-white",
};

export function LevelBadge({ level, big }: { level: string; big?: boolean }) {
  return (
    <span
      className={`mono inline-flex items-center justify-center rounded-lg font-bold ${LEVEL_TONE[level] ?? "bg-surface-2"} ${big ? "h-12 min-w-14 px-2 text-[22px]" : "px-1.5 py-0.5 text-[12px]"}`}
    >
      {level}
    </span>
  );
}

function Diff({
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

function QuestionReview({
  it,
  n,
  chosen,
}: {
  it: CoItem | CeItem;
  n: number;
  chosen: string;
}) {
  const [open, setOpen] = useState(false);
  const ok = chosen === it.answer;
  return (
    <li
      className={`card overflow-hidden ${ok ? "" : "border-l-4 border-l-bad"}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ok ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}
        >
          {ok ? <IconCheck size={14} /> : <IconX size={14} />}
        </span>
        <span className="mono w-6 shrink-0 text-[12px] font-bold">{n}</span>
        <span className="mono shrink-0 text-[11px] text-muted">{it.level}</span>
        <span className="min-w-0 flex-1 truncate text-[14px]">
          {it.question}
        </span>
        <IconChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 text-[14px]">
          <div className="rounded-xl bg-surface-2 px-3 py-3 leading-relaxed">
            <p className="eyebrow mb-1">
              {"turns" in it ? "Transcription" : it.title || "Document"}
            </p>
            {"turns" in it ? (
              it.turns.map((t, k) => (
                <p key={k}>
                  <span className="font-semibold">{t.speaker} : </span>
                  {t.text}
                </p>
              ))
            ) : (
              <p className="whitespace-pre-line">{it.text}</p>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {it.options.map((o, k) => {
              const l = "ABCD"[k];
              return (
                <li
                  key={l}
                  className={`flex gap-2 rounded-lg px-3 py-2 ${l === it.answer ? "bg-ok-bg" : l === chosen ? "bg-bad-bg" : ""}`}
                >
                  <span className="mono font-bold">{l}</span>{" "}
                  <span className="flex-1">{o}</span>
                  {l === it.answer && (
                    <span className="text-[12px] font-semibold text-ok">
                      bonne réponse
                    </span>
                  )}
                  {l === chosen && l !== it.answer && (
                    <span className="text-[12px] font-semibold text-bad">
                      votre choix
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {!chosen && <p className="text-[13px] text-bad">Pas de réponse.</p>}
          <p className="flex gap-2 rounded-xl border border-line px-3 py-2.5 leading-relaxed">
            <IconBook size={15} className="mt-0.5 shrink-0 text-muted" />
            <span>
              <span className="font-semibold">{it.focus} — </span>
              {it.explanation}
            </span>
          </p>
        </div>
      )}
    </li>
  );
}

export function SectionResults({
  test,
  si,
  setErrors,
}: {
  test: TcfTest;
  si: number;
  setErrors: (f: (e: ErrorEntry[]) => ErrorEntry[]) => void;
}) {
  const section = test.plan.sections[si];
  const prog = test.progress[String(si)];
  const r = prog?.result;
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [carnet, setCarnet] = useState<"idle" | "busy" | string>("idle");
  if (!r) return null;
  const answers = prog.answers ?? {};

  async function toCarnet() {
    setCarnet("busy");
    try {
      const res = await fetch(
        `/api/formation/tcf/${encodeURIComponent(test.id)}/carnet`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: si }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        added?: ErrorEntry[];
        bumped?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Échec de l'ajout.");
      const bumped = new Set(json.bumped ?? []);
      setErrors((list) => [
        ...(json.added ?? []),
        ...list.map((e) =>
          bumped.has(e.id) ? { ...e, count: e.count + 1, mastered: false } : e,
        ),
      ]);
      setCarnet(
        `${json.added?.length ?? 0} ajoutée(s), ${bumped.size} déjà présente(s) remontée(s).`,
      );
    } catch (e) {
      setCarnet(e instanceof Error ? e.message : "Échec de l'ajout.");
    }
  }

  const head = (
    <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <LevelBadge level={r.level} big />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{EPREUVE_LABEL[section.epreuve]} · corrigée</p>
        <p className="mt-0.5">
          <span className="mono text-[28px] font-bold">{r.value}</span>
          <span className="mono text-[14px] text-muted">
            {isComprehension(section.epreuve) ? " / 699" : " / 20"}
          </span>
          <span className="ml-3 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold">
            NCLC {r.nclc >= 4 ? r.nclc : "< 4"}
          </span>
        </p>
        {r.grade?.bilan && (
          <p className="mt-2 text-[14px] leading-relaxed">{r.grade.bilan}</p>
        )}
      </div>
    </section>
  );

  if (isComprehension(section.epreuve)) {
    const items = sectionQuestions(test, si);
    const qs = r.questions ?? [];
    const byLevel = LEVELS.map((l) => {
      const q = qs.filter((x) => x.level === l);
      return { l, n: q.length, ok: q.filter((x) => x.correct).length };
    }).filter((x) => x.n);
    const missed = qs.filter((q) => !q.correct).length;
    return (
      <div className="flex flex-col gap-3">
        {head}
        <section className="card p-5">
          <p className="eyebrow mb-3">Réussite par niveau</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {byLevel.map((x) => {
              const pct = Math.round((x.ok / x.n) * 100);
              return (
                <div key={x.l} className="text-center">
                  <div
                    className="relative mx-auto h-20 w-8 overflow-hidden rounded-md bg-surface-2"
                    aria-hidden
                  >
                    <div
                      className={`absolute inset-x-0 bottom-0 rounded-t-[4px] ${pct >= 70 ? "bg-ok" : pct >= 40 ? "bg-signal" : "bg-bad"}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <p className="mono mt-1 text-[12px] font-bold">{x.l}</p>
                  <p className="mono text-[11px] text-muted">
                    {x.ok}/{x.n}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[15px] font-bold">
            Correction{" "}
            <span className="text-[13px] font-normal text-muted">
              · {qs.length - missed}/{qs.length} justes
            </span>
          </h4>
          {missed > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOnlyMissed(!onlyMissed)}
              aria-pressed={onlyMissed}
            >
              {onlyMissed ? "Tout voir" : `Erreurs seulement (${missed})`}
            </button>
          )}
        </div>
        <ol className="flex flex-col gap-2">
          {items.map((it, k) =>
            onlyMissed && answers[it.id] === it.answer ? null : (
              <QuestionReview
                key={it.id}
                it={it}
                n={k + 1}
                chosen={answers[it.id] ?? ""}
              />
            ),
          )}
        </ol>
      </div>
    );
  }

  const tasks = sectionTasks(test, si);
  const nErrors = r.grade?.tasks.reduce((s, t) => s + t.erreurs.length, 0) ?? 0;
  return (
    <div className="flex flex-col gap-3">
      {head}
      {r.grade?.tasks.map((g) => {
        const t = tasks.find((x) => x.task === g.task);
        const ans = answers[`t${g.task}`] ?? "";
        return (
          <section key={g.task} className="card flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-display text-[16px] font-bold">
                Tâche {g.task}
              </h4>
              <span className="flex items-center gap-2">
                <LevelBadge
                  level={
                    g.note >= 16
                      ? "C2"
                      : g.note >= 14
                        ? "C1"
                        : g.note >= 10
                          ? "B2"
                          : g.note >= 6
                            ? "B1"
                            : g.note >= 4
                              ? "A2"
                              : "A1"
                  }
                />
                <span className="mono text-[18px] font-bold">{g.note}/20</span>
              </span>
            </div>
            {t && <p className="text-[13px] text-muted">{t.consigne}</p>}
            <div className="grid gap-2 text-[14px] sm:grid-cols-2">
              <div className="rounded-xl bg-ok-bg px-3 py-2.5">
                <p className="eyebrow mb-1 !text-ok">Points forts</p>
                <p className="leading-relaxed">{g.points_forts}</p>
              </div>
              <div className="rounded-xl bg-opt-bg px-3 py-2.5">
                <p className="eyebrow mb-1 !text-opt">À améliorer</p>
                <p className="leading-relaxed">{g.a_ameliorer}</p>
              </div>
            </div>
            <div className="grid gap-2 text-[14px] lg:grid-cols-2">
              <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                <p className="eyebrow mb-1">
                  {section.epreuve === "eo"
                    ? "Votre prise de parole (transcrite)"
                    : "Votre texte"}
                </p>
                <p className="leading-relaxed whitespace-pre-line">
                  {ans.trim() ? (
                    <Diff from={ans} to={g.version_corrigee} side="answer" />
                  ) : (
                    <span className="text-muted">Rien</span>
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-ok-bg/60 px-3 py-2.5">
                <p className="eyebrow mb-1 !text-ok">
                  Version corrigée et améliorée
                </p>
                <p className="leading-relaxed whitespace-pre-line">
                  {ans.trim() ? (
                    <Diff from={ans} to={g.version_corrigee} side="fix" />
                  ) : (
                    g.version_corrigee
                  )}
                </p>
              </div>
            </div>
            {g.erreurs.length > 0 && (
              <details className="rounded-xl border border-line px-3 py-2 text-[13.5px]">
                <summary className="cursor-pointer font-semibold">
                  {g.erreurs.length} erreur{g.erreurs.length > 1 ? "s" : ""}{" "}
                  relevée{g.erreurs.length > 1 ? "s" : ""}
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {g.erreurs.map((e, k) => (
                    <li key={k}>
                      <span className="text-bad line-through">{e.wrong}</span> →{" "}
                      <span className="font-semibold text-ok">{e.correct}</span>
                      {e.rule && (
                        <span className="text-muted"> · {e.rule}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="rounded-xl border border-line px-3 py-2.5 text-[13.5px] leading-relaxed">
              <span className="font-semibold">
                Pour viser le niveau suivant :{" "}
              </span>
              {g.niveau_suivant}
            </p>
          </section>
        );
      })}
      {nErrors > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => void toCarnet()}
            disabled={carnet !== "idle"}
          >
            {carnet === "busy" ? (
              <IconRefresh size={15} className="animate-spin" />
            ) : (
              <IconPlus size={15} />
            )}{" "}
            {nErrors > 1
              ? `Ajouter les ${nErrors} erreurs au carnet`
              : "Ajouter l'erreur au carnet"}
          </button>
          {carnet !== "idle" && carnet !== "busy" && (
            <span className="text-[13px] text-muted">{carnet}</span>
          )}
        </div>
      )}
    </div>
  );
}
