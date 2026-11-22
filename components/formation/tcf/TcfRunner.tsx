"use client";

import { useEffect, useRef, useState } from "react";
import {
  EE_WORDS,
  EO_TIMING,
  EPREUVE_LABEL,
  sectionQuestions,
  sectionTasks,
  type CeItem,
  type CoItem,
  type EeTask,
  type EoTask,
  type TcfTest,
} from "@/lib/tcf";
import {
  IconAlert,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
} from "@/components/icons";
import { canListen, canSpeak, listen, speakTurns, voicesReady } from "./speech";

const clockNow = () => Date.now();
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* stockage indisponible */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* rien */
    }
  },
};

/** Consignes officielles affichées avant de lancer le chronomètre. */
const RULES: Record<string, string[]> = {
  co: [
    "Chaque document n'est entendu qu'une seule fois.",
    "Lisez la question et les propositions, puis lancez l'écoute.",
    "Une seule bonne réponse ; pas de retour en arrière.",
    "Les questions vont du plus facile au plus difficile.",
  ],
  ce: [
    "Une seule bonne réponse par question.",
    "Vous pouvez naviguer entre les questions tant qu'il reste du temps.",
    "Les questions vont du plus facile au plus difficile.",
  ],
  ee: [
    "Respectez le nombre de mots demandé pour chaque tâche.",
    "Aucun correcteur : la correction automatique du clavier est désactivée.",
    "Gérez votre temps : le chronomètre est commun aux tâches.",
  ],
  eo: [
    "Tâche 1 : entretien dirigé sans préparation (2 min).",
    "Tâche 2 : préparation 2 min, puis interaction 5 min 30 : posez vos questions pour obtenir les informations.",
    "Tâche 3 : point de vue sans préparation (4 min 30).",
    "Votre voix est transcrite puis corrigée : la prononciation n'est pas évaluée.",
  ],
};

function Options({
  options,
  value,
  onChange,
  disabled,
  name,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Propositions">
      {options.map((o, i) => {
        const letter = "ABCD"[i];
        const on = value === letter;
        return (
          <label
            key={letter}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-3 text-[15px] leading-snug transition-colors ${on ? "border-ink bg-act-soft" : "border-line hover:border-muted"} ${disabled ? "cursor-default opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              checked={on}
              onChange={() => onChange(letter)}
              disabled={disabled}
              className="sr-only"
            />
            <span
              className={`mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${on ? "bg-ink text-surface" : "bg-surface-2 text-muted"}`}
            >
              {letter}
            </span>
            <span className="pt-0.5">{o}</span>
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compréhension orale : une écoute, pas de retour

function CoRunner({
  items,
  answers,
  setAnswer,
  storeKey,
  onFinish,
  locked,
}: {
  items: CoItem[];
  answers: Record<string, string>;
  setAnswer: (id: string, v: string) => void;
  storeKey: string;
  onFinish: () => void;
  locked: boolean;
}) {
  const [i, setI] = useState(() => store.get(`${storeKey}-i`, 0));
  const [heard, setHeard] = useState<string[]>(() =>
    store.get(`${storeKey}-heard`, []),
  );
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const it = items[Math.min(i, items.length - 1)];
  useEffect(() => () => stopRef.current(), []);

  const play = async () => {
    setPlaying(true);
    const next = [...heard, it.id];
    setHeard(next);
    store.set(`${storeKey}-heard`, next);
    await voicesReady();
    stopRef.current = speakTurns(it.turns, it.level, () => setPlaying(false));
  };
  const next = () => {
    stopRef.current();
    setPlaying(false);
    if (i >= items.length - 1) return onFinish();
    setI(i + 1);
    store.set(`${storeKey}-i`, i + 1);
  };
  const was = heard.includes(it.id);
  return (
    <article className="card flex flex-col gap-4 p-5 sm:p-7">
      <header className="flex items-baseline justify-between gap-2">
        <span>
          <span className="mono text-[26px] font-bold">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="mono ml-1 text-[12px] text-faint">
            / {items.length}
          </span>
        </span>
        <span className="text-[12px] text-muted">{it.context}</span>
      </header>
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-night px-5 py-6 text-center text-night-ink">
        {!canSpeak() ? (
          <p className="text-[13px] text-night-muted">
            La lecture audio n&apos;est pas disponible sur cet appareil.
          </p>
        ) : playing ? (
          <>
            <span className="flex h-8 items-end gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((b) => (
                <span
                  key={b}
                  className="w-1.5 animate-pulse rounded-full bg-signal"
                  style={{
                    height: `${40 + ((b * 37) % 60)}%`,
                    animationDelay: `${b * 120}ms`,
                  }}
                />
              ))}
            </span>
            <p className="text-[13px] text-night-muted">Écoute en cours…</p>
          </>
        ) : was ? (
          <p className="text-[13px] text-night-muted">
            Document déjà écouté : choisissez votre réponse.
          </p>
        ) : (
          <button
            type="button"
            className="btn bg-signal px-5 py-3 text-[15px] text-night"
            onClick={() => void play()}
            disabled={locked}
          >
            ▶ Écouter le document{" "}
            <span className="text-[12px] font-normal">(une seule écoute)</span>
          </button>
        )}
      </div>
      <p className="text-[15.5px] font-semibold">{it.question}</p>
      <Options
        name={it.id}
        options={it.options}
        value={answers[it.id] ?? ""}
        onChange={(v) => setAnswer(it.id, v)}
        disabled={locked || (!was && canSpeak())}
      />
      <footer className="flex justify-end border-t border-line pt-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={next}
          disabled={locked || (canSpeak() && (!was || playing))}
        >
          {i >= items.length - 1 ? (
            <>
              Terminer l&apos;épreuve <IconCheck size={16} />
            </>
          ) : (
            <>
              Question suivante <IconChevronRight size={16} />
            </>
          )}
        </button>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Compréhension écrite

function CeRunner({
  items,
  answers,
  setAnswer,
  onFinish,
  locked,
}: {
  items: CeItem[];
  answers: Record<string, string>;
  setAnswer: (id: string, v: string) => void;
  onFinish: () => void;
  locked: boolean;
}) {
  const [i, setI] = useState(0);
  const it = items[i];
  const top = useRef<HTMLDivElement>(null);
  const go = (n: number) => {
    setI(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-3">
      <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
        {items.map((q, n) => (
          <button
            key={q.id}
            type="button"
            onClick={() => go(n)}
            aria-current={n === i ? "step" : undefined}
            className={`mono h-8 w-8 rounded-lg text-[12px] font-bold ${n === i ? "bg-signal text-night" : answers[q.id] ? "bg-ink text-surface" : "bg-surface-2 text-muted"}`}
          >
            {n + 1}
          </button>
        ))}
      </nav>
      <article className="card flex flex-col gap-4 p-5 sm:p-7">
        <header className="flex items-baseline justify-between gap-2">
          <span>
            <span className="mono text-[26px] font-bold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="mono ml-1 text-[12px] text-faint">
              / {items.length}
            </span>
          </span>
          <span className="text-[12px] text-muted">{it.context}</span>
        </header>
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-4">
          {it.title && (
            <p className="mb-2 font-display text-[16px] font-bold">
              {it.title}
            </p>
          )}
          <p className="text-[15px] leading-relaxed whitespace-pre-line">
            {it.text}
          </p>
        </div>
        <p className="text-[15.5px] font-semibold">{it.question}</p>
        <Options
          name={it.id}
          options={it.options}
          value={answers[it.id] ?? ""}
          onChange={(v) => setAnswer(it.id, v)}
          disabled={locked}
        />
        <footer className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => go(i - 1)}
            disabled={i === 0}
          >
            <IconChevronLeft size={16} /> Précédente
          </button>
          {i < items.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go(i + 1)}
            >
              Suivante <IconChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onFinish}
              disabled={locked}
            >
              Terminer l&apos;épreuve <IconCheck size={16} />
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expression écrite

function EeRunner({
  tasks,
  answers,
  setAnswer,
  onFinish,
  locked,
}: {
  tasks: EeTask[];
  answers: Record<string, string>;
  setAnswer: (id: string, v: string) => void;
  onFinish: () => void;
  locked: boolean;
}) {
  const [i, setI] = useState(0);
  const t = tasks[i];
  const key = `t${t.task}`;
  const [min, max] = EE_WORDS[Number(t.task)];
  const n = words(answers[key] ?? "");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5" role="tablist" aria-label="Tâches">
        {tasks.map((x, k) => {
          const c = words(answers[`t${x.task}`] ?? "");
          return (
            <button
              key={x.task}
              type="button"
              role="tab"
              aria-selected={k === i}
              onClick={() => setI(k)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${k === i ? "bg-ink text-surface" : "bg-surface-2 text-muted"}`}
            >
              Tâche {x.task}{" "}
              <span className="mono font-normal opacity-70">· {c} mots</span>
            </button>
          );
        })}
      </div>
      <article className="card flex flex-col gap-4 p-5 sm:p-7">
        <p className="text-[15px] leading-relaxed font-medium whitespace-pre-line">
          {t.consigne}
        </p>
        {t.documents.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {t.documents.map((d, k) => (
              <div
                key={k}
                className="rounded-xl border border-line bg-surface-2 px-4 py-3"
              >
                <p className="mb-1 text-[13px] font-bold">
                  Document {k + 1} · {d.title}
                </p>
                <p className="text-[14px] leading-relaxed">{d.text}</p>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={answers[key] ?? ""}
          onChange={(e) => setAnswer(key, e.target.value)}
          disabled={locked}
          rows={12}
          className="input text-[15.5px] leading-relaxed"
          placeholder="Rédigez votre texte ici"
          aria-label={`Texte de la tâche ${t.task}`}
          spellCheck={false}
          autoCorrect="off"
          autoComplete="off"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span
            className={`mono font-semibold ${n === 0 ? "text-muted" : n < min || n > max ? "text-opt" : "text-ok"}`}
          >
            {n} mots{" "}
            <span className="font-normal text-muted">
              · attendu {min} à {max}
            </span>
          </span>
          {i < tasks.length - 1 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setI(i + 1)}
            >
              Tâche suivante <IconChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onFinish}
              disabled={locked}
            >
              Rendre ma copie <IconCheck size={16} />
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expression orale

function EoRunner({
  tasks,
  answers,
  setAnswer,
  onFinish,
  locked,
}: {
  tasks: EoTask[];
  answers: Record<string, string>;
  setAnswer: (id: string, v: string) => void;
  onFinish: () => void;
  locked: boolean;
}) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"idle" | "prep" | "speak" | "done">(
    "idle",
  );
  const [phaseStart, setPhaseStart] = useState(0);
  const [now, setNow] = useState(0);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const t = tasks[i];
  const key = `t${t.task}`;
  const timing = EO_TIMING[Number(t.task)];
  const typing = !canListen() || !!micError;

  const startSpeak = () => {
    const t0 = clockNow();
    setPhase("speak");
    setPhaseStart(t0);
    setNow(t0);
    setInterim("");
    if (!typing) {
      const base = answers[key] ? `${answers[key]} ` : "";
      recRef.current = listen(
        (finalText, inter) => {
          setAnswer(key, `${base}${finalText}`.trim());
          setInterim(inter);
        },
        (msg) => setMicError(msg),
      );
    }
  };
  const stopSpeak = () => {
    recRef.current?.stop();
    recRef.current = null;
    setInterim("");
    setPhase("done");
  };
  const begin = () => {
    if (timing.prep) {
      const t0 = clockNow();
      setPhase("prep");
      setPhaseStart(t0);
      setNow(t0);
    } else startSpeak();
  };

  // Chronomètre de la tâche : passage automatique préparation → parole → fin.
  const tick = useRef<() => void>(() => {});
  useEffect(() => {
    tick.current = () => {
      const n = clockNow();
      setNow(n);
      if (phase === "prep" && n - phaseStart >= timing.prep * 1000)
        startSpeak();
      if (phase === "speak" && n - phaseStart >= timing.speak * 1000)
        stopSpeak();
    };
  });
  useEffect(() => {
    if (phase !== "prep" && phase !== "speak") return;
    const id = setInterval(() => tick.current(), 500);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => () => recRef.current?.stop(), []);

  const limit = phase === "prep" ? timing.prep : timing.speak;
  const elapsed = now && phaseStart ? now - phaseStart : 0;
  const left = limit * 1000 - elapsed;
  const relance =
    phase === "speak" && t.relances.length
      ? t.relances[
          Math.min(
            t.relances.length - 1,
            Math.floor(
              elapsed / ((timing.speak * 1000) / (t.relances.length + 1)),
            ),
          )
        ]
      : null;

  return (
    <article className="card flex flex-col gap-4 p-5 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-[18px] font-bold">
          Tâche {t.task}{" "}
          <span className="mono text-[12px] font-normal text-faint">
            / {tasks.length}
          </span>
        </span>
        <span className="mono text-[12px] text-muted">
          {timing.prep
            ? `préparation ${timing.prep / 60} min · `
            : "sans préparation · "}
          parole {Math.floor(timing.speak / 60)} min{" "}
          {timing.speak % 60 ? `${timing.speak % 60} s` : ""}
        </span>
      </header>
      <p className="text-[15px] leading-relaxed font-medium whitespace-pre-line">
        {t.consigne}
      </p>
      {micError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-opt-bg px-3 py-2 text-[13px] text-opt"
        >
          <IconAlert size={15} className="mt-0.5 shrink-0" /> {micError}
        </p>
      )}

      {phase === "idle" && (
        <button
          type="button"
          className="btn btn-primary self-start px-5 py-3"
          onClick={begin}
          disabled={locked}
        >
          {timing.prep ? "Commencer la préparation" : "Commencer à parler"}{" "}
          <IconChevronRight size={16} />
        </button>
      )}

      {(phase === "prep" || phase === "speak") && (
        <div
          className={`flex flex-col gap-3 rounded-2xl px-5 py-5 ${phase === "speak" ? "bg-night text-night-ink" : "bg-surface-2"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              {phase === "speak" && !typing && (
                <span
                  className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad"
                  aria-hidden
                />
              )}
              {phase === "prep"
                ? "Préparation"
                : typing
                  ? "Réponse (saisie)"
                  : "Enregistrement"}
            </span>
            <span className="mono text-[24px] font-bold">{fmt(left)}</span>
          </div>
          {relance && (
            <p className="rounded-xl bg-night-2 px-4 py-3 text-[15px]">
              <span className="text-[11px] tracking-[0.1em] text-night-muted uppercase">
                Examinateur ·{" "}
              </span>
              {relance}
            </p>
          )}
          {phase === "prep" ? (
            <>
              <textarea
                className="input text-[14px]"
                rows={4}
                placeholder="Brouillon (non corrigé) : notez vos questions ou vos idées"
                aria-label="Brouillon de préparation"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm self-end"
                onClick={startSpeak}
              >
                Je suis prêt, commencer à parler
              </button>
            </>
          ) : typing ? (
            <textarea
              value={answers[key] ?? ""}
              onChange={(e) => setAnswer(key, e.target.value)}
              rows={6}
              className="input text-[15px]"
              aria-label="Votre réponse orale, tapée"
            />
          ) : (
            <p className="min-h-16 text-[15px] leading-relaxed text-night-ink/90">
              {answers[key]}
              {interim && <span className="text-night-muted"> {interim}</span>}
              {!answers[key] && !interim && (
                <span className="text-night-muted">
                  Parlez : votre réponse s&apos;affiche ici.
                </span>
              )}
            </p>
          )}
          {phase === "speak" && (
            <button
              type="button"
              className="btn bg-signal self-end text-night"
              onClick={stopSpeak}
            >
              J&apos;ai terminé
            </button>
          )}
        </div>
      )}

      {phase === "done" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-muted">
              Transcription : corrigez uniquement les erreurs de la dictée, pas
              votre français.
            </span>
            <textarea
              value={answers[key] ?? ""}
              onChange={(e) => setAnswer(key, e.target.value)}
              rows={5}
              className="input text-[14.5px]"
              disabled={locked}
              spellCheck={false}
            />
          </label>
          <div className="flex justify-end">
            {i < tasks.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setI(i + 1);
                  setPhase("idle");
                }}
              >
                Tâche suivante <IconChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onFinish}
                disabled={locked}
              >
                Terminer l&apos;épreuve <IconCheck size={16} />
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Section complète : consignes, chronomètre, envoi

export function TcfRunner({
  test,
  si,
  onUpdate,
  onExit,
}: {
  test: TcfTest;
  si: number;
  onUpdate: (t: TcfTest) => void;
  onExit: () => void;
}) {
  const section = test.plan.sections[si];
  const prog = test.progress[String(si)] ?? {};
  const storeKey = `pcc-tcf-${test.id}-${si}`;
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    store.get(storeKey, {}),
  );
  const [busy, setBusy] = useState<"start" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  const started = prog.started_at ? Date.parse(prog.started_at) : null;
  // L'expression orale suit ses propres minuteurs par tâche : pas de limite globale stricte.
  const deadline =
    started && section.epreuve !== "eo"
      ? started + section.minutes * 60_000
      : null;
  const left = deadline && now ? deadline - now : null;

  useEffect(() => {
    if (!deadline || prog.submitted_at) return;
    const id = setInterval(() => {
      const n = clockNow();
      setNow(n);
      if (n >= deadline) submitRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, prog.submitted_at]);

  const setAnswer = (id: string, v: string) =>
    setAnswers((a) => {
      const next = { ...a, [id]: v };
      store.set(storeKey, next);
      return next;
    });

  async function call(action: "start" | "submit") {
    const res = await fetch(
      `/api/formation/tcf/${encodeURIComponent(test.id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: si,
          action,
          answers: action === "submit" ? answers : undefined,
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      test?: TcfTest;
      error?: string;
    };
    if (!res.ok || !json.test)
      throw new Error(json.error ?? "La demande a échoué. Réessayez.");
    return json.test;
  }

  async function start() {
    setBusy("start");
    setError(null);
    try {
      onUpdate(await call("start"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer.");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (busy === "submit") return;
    setBusy("submit");
    setError(null);
    setConfirm(false);
    let settled = false;
    // La correction des expressions peut être longue : si la réponse se perd, on la retrouve en base.
    const poll = async () => {
      const until = clockNow() + 6 * 60_000;
      while (!settled && clockNow() < until) {
        await new Promise((r) => setTimeout(r, 15_000));
        if (settled) return null;
        try {
          const res = await fetch(
            `/api/formation/tcf/${encodeURIComponent(test.id)}`,
            { cache: "no-store" },
          );
          const json = (await res.json().catch(() => ({}))) as {
            test?: TcfTest;
          };
          if (json.test?.progress[String(si)]?.result) return json.test;
        } catch {
          /* on réessaie */
        }
      }
      return null;
    };
    const post = call("submit");
    const polled = poll();
    try {
      // Safari sur iPad coupe une requête sans réponse au bout d'une minute (« Load failed ») alors que
      // le serveur continue la correction : dans ce cas, on attend le résultat en relisant le test.
      const t = await Promise.race([
        post.catch((e: unknown) =>
          e instanceof TypeError
            ? polled.then(
                (x) =>
                  x ??
                  Promise.reject(
                    new Error(
                      "La correction prend plus de temps que prévu. Revenez dans quelques minutes : vos réponses sont gardées.",
                    ),
                  ),
              )
            : Promise.reject(e),
        ),
        polled.then((x) => x ?? post),
      ]);
      store.del(storeKey);
      store.del(`${storeKey}-i`);
      store.del(`${storeKey}-heard`);
      onUpdate(t);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "La correction a échoué. Vos réponses sont gardées : réessayez.",
      );
    } finally {
      settled = true;
      setBusy(null);
    }
  }
  useEffect(() => {
    submitRef.current = () => void submit();
  });

  const questions = sectionQuestions(test, si);
  const tasks = sectionTasks(test, si);
  const count = section.levels?.length ?? section.tasks?.length ?? 0;
  const answered = section.levels
    ? questions.filter((q) => answers[q.id]).length
    : tasks.filter((t) => (answers[`t${t.task}`] ?? "").trim()).length;
  const locked = busy !== null;

  if (!started)
    return (
      <section className="card flex flex-col gap-5 overflow-hidden">
        <div className="bg-night px-5 py-6 text-night-ink sm:px-7">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
            {test.title}
          </p>
          <h3 className="mt-1 font-display text-[22px] font-bold">
            {EPREUVE_LABEL[section.epreuve]}
          </h3>
          <p className="mono mt-1 text-[13px] text-night-muted">
            {section.levels
              ? `${count} questions`
              : `${count} tâche${count > 1 ? "s" : ""}`}{" "}
            · {section.minutes} min
          </p>
        </div>
        <ul className="flex flex-col gap-2 px-5 sm:px-7">
          {RULES[section.epreuve].map((r) => (
            <li key={r} className="flex gap-2 text-[14px]">
              <IconCheck size={15} className="mt-0.5 shrink-0 text-muted" /> {r}
            </li>
          ))}
        </ul>
        {section.epreuve === "co" && !canSpeak() && (
          <p className="mx-5 rounded-xl bg-opt-bg px-3 py-2 text-[13px] text-opt sm:mx-7">
            Cet appareil ne lit pas l&apos;audio : passez l&apos;épreuve sur
            l&apos;iPad.
          </p>
        )}
        {section.epreuve === "eo" && !canListen() && (
          <p className="mx-5 rounded-xl bg-opt-bg px-3 py-2 text-[13px] text-opt sm:mx-7">
            La dictée n&apos;est pas disponible ici : vous taperez vos réponses.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mx-5 rounded-xl bg-bad-bg px-3 py-2 text-[13px] text-bad sm:mx-7"
          >
            {error}
          </p>
        )}
        <div className="flex justify-between gap-3 border-t border-line px-5 py-4 sm:px-7">
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            Plus tard
          </button>
          <button
            type="button"
            className="btn btn-primary px-5"
            onClick={() => void start()}
            disabled={busy !== null}
          >
            {busy === "start" ? (
              <IconRefresh size={16} className="animate-spin" />
            ) : null}{" "}
            Lancer le chronomètre
          </button>
        </div>
      </section>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-night px-4 py-2.5 text-night-ink shadow-lg">
        <span className="text-[13px] font-semibold">
          {EPREUVE_LABEL[section.epreuve]}
          <span className="mono ml-2 font-normal text-night-muted">
            {answered}/{count}
          </span>
        </span>
        {left != null && (
          <span
            className={`mono text-[20px] font-bold ${left < 60_000 ? "text-bad" : left < 5 * 60_000 ? "text-signal" : ""}`}
          >
            {fmt(left)}
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-bad-bg px-4 py-3 text-[13.5px] text-bad"
        >
          <IconAlert size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {busy === "submit" ? (
        <section className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <IconRefresh size={22} className="animate-spin text-muted" />
          <p className="font-display text-[17px] font-bold">
            {section.levels
              ? "Calcul de votre score…"
              : "Claude corrige votre production…"}
          </p>
          {!section.levels && (
            <p className="text-[13px] text-muted">
              Une à trois minutes, selon la longueur. Vous pouvez laisser la
              page ouverte.
            </p>
          )}
        </section>
      ) : (
        <>
          {section.epreuve === "co" && (
            <CoRunner
              items={questions as CoItem[]}
              answers={answers}
              setAnswer={setAnswer}
              storeKey={storeKey}
              onFinish={() => setConfirm(true)}
              locked={locked}
            />
          )}
          {section.epreuve === "ce" && (
            <CeRunner
              items={questions as CeItem[]}
              answers={answers}
              setAnswer={setAnswer}
              onFinish={() => setConfirm(true)}
              locked={locked}
            />
          )}
          {section.epreuve === "ee" && (
            <EeRunner
              tasks={tasks as EeTask[]}
              answers={answers}
              setAnswer={setAnswer}
              onFinish={() => setConfirm(true)}
              locked={locked}
            />
          )}
          {section.epreuve === "eo" && (
            <EoRunner
              tasks={tasks as EoTask[]}
              answers={answers}
              setAnswer={setAnswer}
              onFinish={() => setConfirm(true)}
              locked={locked}
            />
          )}
        </>
      )}

      {confirm && busy === null && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg">
          <span className="text-[13.5px]">
            Rendre l&apos;épreuve ?{" "}
            {answered < count && (
              <span className="text-bad">
                {count - answered} sans réponse{count - answered > 1 ? "s" : ""}
                .
              </span>
            )}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirm(false)}
            >
              Continuer
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void submit()}
            >
              Rendre
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
