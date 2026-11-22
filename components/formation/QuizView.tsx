"use client";

import { useEffect, useMemo, useState } from "react";
import type { ErrorEntry } from "@/lib/formation";
import { KIND_LABEL, SOURCE_LABEL, progressOf, type ItemResult, type PublicQuizItem, type Quiz } from "@/lib/quiz";
import { EmptyState } from "@/components/ui";
import { IconAlert, IconCheck, IconChevronDown, IconGauge, IconRefresh, IconX } from "@/components/icons";
import { fmtDay } from "./shared";

const DRAFT_KEY = (id: string) => `pcc-quiz-${id}`;

function readDraft(id: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY(id)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function Mark({ score }: { score: number }) {
  if (score >= 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-semibold text-ok">
        <IconCheck size={13} /> Juste
      </span>
    );
  if (score > 0) return <span className="rounded-full bg-opt-bg px-2 py-0.5 text-[12px] font-semibold text-opt">½ Partiel</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bad-bg px-2 py-0.5 text-[12px] font-semibold text-bad">
      <IconX size={13} /> À revoir
    </span>
  );
}

function ItemHead({ item, n }: { item: PublicQuizItem; n: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
      <span className="mono font-semibold text-ink">{n}.</span>
      <span className="font-semibold">{KIND_LABEL[item.kind]}</span>
      <span>·</span>
      <span>{item.skill}</span>
      <span>·</span>
      <span>{SOURCE_LABEL[item.source]}</span>
    </div>
  );
}

function AnswerField({ item, value, onChange, disabled }: { item: PublicQuizItem; value: string; onChange: (v: string) => void; disabled: boolean }) {
  if (item.kind === "qcm")
    return (
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`Réponse à l'exercice ${item.id}`}>
        {item.options.map((o) => (
          <label key={o} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[14px] ${value === o ? "border-act bg-act-soft" : "border-line"}`}>
            <input type="radio" name={item.id} checked={value === o} onChange={() => onChange(o)} disabled={disabled} className="mt-1 accent-[var(--color-act)]" />
            <span>{o}</span>
          </label>
        ))}
      </div>
    );
  if (item.kind === "trou")
    return <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="input" placeholder="Votre réponse" aria-label={`Réponse à l'exercice ${item.id}`} autoComplete="off" autoCapitalize="off" spellCheck={false} />;
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={item.kind === "production" ? 4 : 2}
      className="input"
      placeholder="Votre réponse"
      aria-label={`Réponse à l'exercice ${item.id}`}
      spellCheck={false}
    />
  );
}

function CorrectedItem({ item, n, answer, result }: { item: PublicQuizItem; n: number; answer: string; result: ItemResult | undefined }) {
  return (
    <li className="card flex flex-col gap-2 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <ItemHead item={item} n={n} />
        {result && <Mark score={result.score} />}
      </div>
      <p className="text-[13px] text-muted">{item.instruction}</p>
      <p className="text-[14.5px] font-medium whitespace-pre-line">{item.prompt}</p>
      <div className="grid gap-2 text-[13.5px] sm:grid-cols-2">
        <div className={`rounded-xl px-3 py-2 ${result && result.score >= 1 ? "bg-ok-bg" : "bg-bad-bg"}`}>
          <p className="text-[11.5px] font-semibold text-muted">Votre réponse</p>
          <p className="whitespace-pre-line">{answer.trim() || "—"}</p>
        </div>
        {result && result.score < 1 && (
          <div className="rounded-xl bg-ok-bg px-3 py-2">
            <p className="text-[11.5px] font-semibold text-ok">Correction</p>
            <p className="whitespace-pre-line">{result.corrected || item.accepted?.[0] || "—"}</p>
          </div>
        )}
      </div>
      {result?.feedback && result.score < 1 && <p className="text-[13.5px]">{result.feedback}</p>}
      {item.explanation && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          <span className="font-semibold">Règle · {item.topic} : </span>
          {item.explanation}
        </p>
      )}
    </li>
  );
}

function Progress({ quizzes, today }: { quizzes: Quiz[]; today: string }) {
  const p = useMemo(() => progressOf(quizzes, today), [quizzes, today]);
  if (!p.done) return null;
  const trend = p.last7 != null && p.prev7 != null ? p.last7 - p.prev7 : null;
  const weak = p.byTopic.filter((t) => t.n >= 2 && t.rate < 75).slice(0, 6);
  const strong = p.byTopic.filter((t) => t.n >= 2 && t.rate >= 90).slice(-6);
  return (
    <section className="card flex flex-col gap-4 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <IconGauge size={16} /> Vos progrès
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Séries corrigées", value: String(p.done) },
          { label: "Moyenne", value: p.average == null ? "—" : `${p.average} %` },
          { label: "7 derniers jours", value: p.last7 == null ? "—" : `${p.last7} %` },
          { label: "Évolution", value: trend == null ? "—" : `${trend > 0 ? "+" : ""}${trend} pts`, sub: trend == null ? "après deux semaines" : "par rapport à la semaine d'avant" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-[11.5px] font-semibold text-muted">{s.label}</p>
            <p className="mono text-[20px] font-bold">{s.value}</p>
            {s.sub && <p className="text-[11px] text-muted">{s.sub}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-muted">Par épreuve</p>
          <ul className="flex flex-col gap-2">
            {p.bySkill.map((s) => (
              <li key={s.skill} className="text-[13px]">
                <div className="flex justify-between">
                  <span>{s.skill}</span>
                  <span className="mono text-muted">
                    {s.rate} % · {s.n} ex.
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                  <div className={`h-full rounded-full ${s.rate >= 80 ? "bg-ok" : s.rate >= 50 ? "bg-signal" : "bg-bad"}`} style={{ width: `${Math.max(4, s.rate)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 text-[13px]">
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-muted">À revoir en priorité</p>
            {weak.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {weak.map((t) => (
                  <li key={t.topic} className="rounded-full bg-bad-bg px-2.5 py-1 text-bad">
                    {t.topic} · {t.rate} %
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Rien de récurrent pour l&apos;instant.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-muted">Acquis</p>
            {strong.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {strong.map((t) => (
                  <li key={t.topic} className="rounded-full bg-ok-bg px-2.5 py-1 text-ok">
                    {t.topic}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Une règle compte comme acquise après deux réussites.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

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
  // Brouillon des réponses gardé sur l'appareil : rien n'est perdu si la page se recharge.
  // (L'onglet n'est jamais rendu côté serveur : lire le stockage ici ne crée pas d'écart d'hydratation.)
  const [answers, setAnswers] = useState<Record<string, string>>(() => (current?.status === "pret" ? readDraft(current.id) : {}));
  const [busy, setBusy] = useState<"prepare" | "grade" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPast, setOpenPast] = useState<string | null>(null);

  useEffect(() => {
    if (!current || current.status !== "pret") return;
    try {
      localStorage.setItem(DRAFT_KEY(current.id), JSON.stringify(answers));
    } catch {
      /* stockage indisponible : le brouillon n'est simplement pas gardé */
    }
  }, [answers, current]);

  async function prepare() {
    setBusy("prepare");
    setError(null);
    try {
      const res = await fetch("/api/formation/quiz", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { quiz?: Quiz; error?: string };
      if (!res.ok || !json.quiz) throw new Error(json.error ?? "La série n'a pas pu être préparée. Réessayez.");
      setQuizzes((list) => [json.quiz!, ...list.filter((q) => q.id !== json.quiz!.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La série n'a pas pu être préparée.");
    } finally {
      setBusy(null);
    }
  }

  async function grade() {
    if (!current) return;
    setBusy("grade");
    setError(null);
    try {
      const res = await fetch(`/api/formation/quiz/${encodeURIComponent(current.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = (await res.json().catch(() => ({}))) as { quiz?: Quiz; bumped?: string[]; error?: string };
      if (!res.ok || !json.quiz) throw new Error(json.error ?? "La correction a échoué. Réessayez.");
      setQuizzes((list) => list.map((q) => (q.id === json.quiz!.id ? json.quiz! : q)));
      if (json.bumped?.length) {
        const ids = new Set(json.bumped);
        setErrors((list) => list.map((e) => (ids.has(e.id) ? { ...e, count: Math.min(999, e.count + 1), mastered: false } : e)));
      }
      try {
        localStorage.removeItem(DRAFT_KEY(current.id));
      } catch {
        /* rien à nettoyer */
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "La correction a échoué.");
    } finally {
      setBusy(null);
    }
  }

  const answered = current ? current.items.filter((it) => (answers[it.id] ?? "").trim()).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Chaque jour, Claude prépare une série de 10 exercices à partir de votre carnet d&apos;erreurs, de votre aide-mémoire et du cours de la semaine, puis la corrige. Une faute du carnet ratée de nouveau voit son compteur augmenter.
      </p>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          <IconAlert size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {!current ? (
        <section className="card flex flex-col items-center gap-3 px-6 py-8 text-center">
          <p className="font-display text-[17px] font-bold">Série du {fmtDay(today)}</p>
          <p className="max-w-md text-[13.5px] text-muted">Une quinzaine de minutes : choix multiples, textes à trous, phrases à corriger, reformulations et une courte production écrite.</p>
          {canEdit ? (
            <button type="button" className="btn btn-primary" onClick={() => void prepare()} disabled={busy !== null}>
              {busy === "prepare" ? (
                <>
                  <IconRefresh size={16} className="animate-spin" /> Claude prépare vos exercices…
                </>
              ) : (
                "Préparer la série du jour"
              )}
            </button>
          ) : (
            <p className="text-[13px] text-muted">Seul le titulaire du dossier peut lancer la série.</p>
          )}
          {busy === "prepare" && <p className="text-[12px] text-muted">Cela prend en général une à deux minutes. Gardez la page ouverte.</p>}
        </section>
      ) : current.status === "pret" ? (
        <>
          <section className="card p-4 sm:p-5">
            <p className="text-[12px] font-semibold text-muted">Série du {fmtDay(today)}</p>
            <h3 className="mt-0.5 text-[17px] font-bold">{current.title || "Exercices du jour"}</h3>
            {current.focus && <p className="mt-1 text-[13.5px] text-muted">{current.focus}</p>}
          </section>
          <ol className="no-stagger flex flex-col gap-3">
            {current.items.map((it, i) => (
              <li key={it.id} className="card flex flex-col gap-2.5 p-4 sm:p-5">
                <ItemHead item={it} n={i + 1} />
                <p className="text-[13px] text-muted">{it.instruction}</p>
                <p className="text-[14.5px] font-medium whitespace-pre-line">{it.prompt}</p>
                <AnswerField item={it} value={answers[it.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [it.id]: v }))} disabled={busy !== null || !canEdit} />
              </li>
            ))}
          </ol>
          {canEdit && (
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg">
              <span className="text-[13px] text-muted">
                {answered}/{current.items.length} réponses
              </span>
              <button type="button" className="btn btn-primary" onClick={() => void grade()} disabled={busy !== null}>
                {busy === "grade" ? (
                  <>
                    <IconRefresh size={16} className="animate-spin" /> Correction en cours…
                  </>
                ) : answered < current.items.length ? (
                  "Corriger (réponses vides comptées fausses)"
                ) : (
                  "Corriger la série"
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <section className="card flex flex-col gap-2 p-4 sm:p-5">
            <p className="text-[12px] font-semibold text-muted">Série du {fmtDay(today)} · corrigée</p>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="mono text-[34px] font-bold">
                {current.score}/{current.total}
              </span>
              <span className="text-[15px] font-semibold">{current.title}</span>
            </div>
            {current.summary && <p className="text-[14px]">{current.summary}</p>}
            <p className="text-[12.5px] text-muted">Prochaine série demain.</p>
          </section>
          <ol className="no-stagger flex flex-col gap-3">
            {current.items.map((it, i) => (
              <CorrectedItem key={it.id} item={it} n={i + 1} answer={current.answers?.[it.id] ?? ""} result={current.results?.find((r) => r.id === it.id)} />
            ))}
          </ol>
        </>
      )}

      <Progress quizzes={quizzes} today={today} />

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[14px] font-bold">Séries précédentes</h3>
          {past.map((q) => (
            <article key={q.id} className="card overflow-hidden">
              <button type="button" onClick={() => setOpenPast((o) => (o === q.id ? null : q.id))} aria-expanded={openPast === q.id} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="mono w-14 shrink-0 text-[15px] font-bold">{q.score == null ? "—" : `${q.score}/${q.total}`}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{q.title || "Série"}</span>
                  <span className="block text-[12px] text-muted">
                    {fmtDay(q.day, { weekday: "long", day: "numeric", month: "long" })}
                    {q.status === "pret" ? " · non corrigée" : ""}
                  </span>
                </span>
                <IconChevronDown size={18} className={`shrink-0 text-muted transition-transform ${openPast === q.id ? "rotate-180" : ""}`} />
              </button>
              {openPast === q.id && (
                <ol className="flex flex-col gap-3 border-t border-line bg-surface-2/40 p-3">
                  {q.status === "corrige" ? (
                    q.items.map((it, i) => <CorrectedItem key={it.id} item={it} n={i + 1} answer={q.answers?.[it.id] ?? ""} result={q.results?.find((r) => r.id === it.id)} />)
                  ) : (
                    <li className="px-2 py-1 text-[13px] text-muted">Cette série n&apos;a pas été corrigée le jour même.</li>
                  )}
                </ol>
              )}
            </article>
          ))}
        </section>
      )}

      {!current && past.length === 0 && !canEdit && <EmptyState title="Aucune série pour l'instant" />}
    </div>
  );
}
