"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ErrorEntry } from "@/lib/formation";
import {
  C2_TARGET,
  EPREUVES,
  EPREUVE_LABEL,
  EPREUVE_SHORT,
  LEVELS,
  MAX_VALUE,
  ROTATION,
  currentEstimates,
  historyOf,
  isComprehension,
  isReady,
  levelOf,
  nclcOf,
  kindFor,
  planFor,
  weekdayOf,
  type Epreuve,
  type TcfTest,
} from "@/lib/tcf";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconExternal,
  IconGlobe,
  IconRefresh,
} from "@/components/icons";
import { fmtDay } from "../shared";
import { TcfRunner } from "./TcfRunner";
import { LevelBadge, SectionResults } from "./TcfResults";

const clockNow = () => Date.now();
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
  0: "Dim",
};
const unit = (e: Epreuve) => (isComprehension(e) ? "/699" : "/20");
/** Position (0–1) d'une valeur sur l'échelle A1 → C2. */
function scalePos(e: Epreuve, v: number): number {
  if (isComprehension(e)) return Math.max(0, Math.min(1, (v - 100) / 600));
  // Expression : A1 0–3, A2 4–5, B1 6–9, B2 10–13, C1 14–15, C2 16–20 → six cases égales.
  const bands: Array<[number, number]> = [
    [0, 4],
    [4, 6],
    [6, 10],
    [10, 14],
    [14, 16],
    [16, 20.0001],
  ];
  const i = bands.findIndex(([a, b]) => v >= a && v < b);
  const [a, b] = bands[Math.max(0, i)];
  return Math.min(1, (Math.max(0, i) + (v - a) / (b - a)) / 6);
}

// ---------------------------------------------------------------------------
// Objectif C2

function GoalPanel({ tests }: { tests: TcfTest[] }) {
  const est = useMemo(() => currentEstimates(tests), [tests]);
  const hist = useMemo(() => historyOf(tests), [tests]);
  return (
    <section className="card overflow-hidden" aria-labelledby="tcf-goal">
      <div className="bg-night px-5 pt-5 pb-4 text-night-ink sm:px-7">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          TCF Canada · objectif
        </p>
        <h3 id="tcf-goal" className="mt-1 font-display text-[22px] font-bold">
          Votre chemin vers C2
        </h3>
        <p className="mt-1 text-[13px] text-night-muted">
          Niveau estimé d&apos;après vos trois derniers résultats dans chaque
          épreuve. C2 = 600/699 en compréhension, 16/20 en expression ; NCLC 10
          (maximum de points Entrée express) = 549/699 et 16/20.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {EPREUVES.map((e) => {
          const v = est[e];
          const h = hist[e];
          const prev = h.length > 1 ? h[h.length - 2].value : null;
          const last = h.at(-1)?.value;
          const trend = prev != null && last != null ? last - prev : null;
          const gap = v != null ? C2_TARGET[e] - v : null;
          return (
            <li
              key={e}
              className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[13rem_1fr_9rem] sm:px-7"
            >
              <div className="flex items-center gap-3">
                {v != null ? (
                  <LevelBadge level={levelOf(e, v)} />
                ) : (
                  <span className="mono rounded-lg bg-surface-2 px-1.5 py-0.5 text-[12px] text-muted">
                    ?
                  </span>
                )}
                <span>
                  <span className="block text-[14px] font-semibold">
                    {EPREUVE_LABEL[e]}
                  </span>
                  <span className="mono block text-[12px] text-muted">
                    {v != null ? (
                      <>
                        {v}
                        {unit(e)} · NCLC{" "}
                        {nclcOf(e, v) >= 4 ? nclcOf(e, v) : "< 4"}
                        {trend != null && trend !== 0 && (
                          <span className={trend > 0 ? "text-ok" : "text-bad"}>
                            {" "}
                            {trend > 0 ? `▲ +${trend}` : `▼ ${trend}`}
                          </span>
                        )}
                      </>
                    ) : (
                      "à mesurer"
                    )}
                  </span>
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div
                  className="relative grid h-3 grid-cols-6 gap-[2px]"
                  role="img"
                  aria-label={
                    v != null
                      ? `${EPREUVE_LABEL[e]} : niveau ${levelOf(e, v)}, objectif C2`
                      : `${EPREUVE_LABEL[e]} : pas encore mesuré`
                  }
                >
                  {LEVELS.map((l, i) => (
                    <span
                      key={l}
                      className={`rounded-[3px] ${i === 5 ? "bg-ok/25" : "bg-surface-2"}`}
                    />
                  ))}
                  {v != null && (
                    <span
                      className="absolute inset-y-0 left-0 rounded-[3px] bg-ink/85"
                      style={{ width: `${Math.max(2, scalePos(e, v) * 100)}%` }}
                    >
                      <span className="absolute -top-1 right-0 h-5 w-1 translate-x-1/2 rounded-full bg-signal" />
                    </span>
                  )}
                </div>
                <div className="mono mt-1 grid grid-cols-6 text-[10px] text-faint">
                  {LEVELS.map((l) => (
                    <span key={l} className="text-center">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <p className="col-span-2 text-[12.5px] sm:col-span-1 sm:text-right">
                {gap == null ? (
                  <span className="text-muted">—</span>
                ) : gap <= 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-ok">
                    <IconCheck size={13} /> Niveau C2
                  </span>
                ) : (
                  <span className="text-muted">
                    C2 : encore{" "}
                    <span className="mono font-semibold text-ink">+{gap}</span>
                    {isComprehension(e) ? " pts" : " / 20"}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Écran principal

type Screen =
  | { mode: "home" }
  | { mode: "run"; id: string; si: number }
  | { mode: "result"; id: string; si: number };

export function TcfView({
  tests,
  setTests,
  setErrors,
  today,
  canEdit,
}: {
  tests: TcfTest[];
  setTests: Dispatch<SetStateAction<TcfTest[]>>;
  setErrors: (f: (e: ErrorEntry[]) => ErrorEntry[]) => void;
  today: string;
  canEdit: boolean;
}) {
  const [screen, setScreen] = useState<Screen>({ mode: "home" });
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openHist, setOpenHist] = useState<string | null>(null);

  const upsert = (t: TcfTest) =>
    setTests((list) =>
      [t, ...list.filter((x) => x.id !== t.id)].sort((a, b) =>
        b.day.localeCompare(a.day),
      ),
    );
  const todays = tests.filter((t) => t.day === today);
  const current =
    todays.find((t) => t.status !== "corrige") ?? todays[0] ?? null;
  const past = tests.filter((t) => t !== current);
  const graded = useMemo(
    () => tests.filter((t) => Object.values(t.progress).some((p) => p.result)),
    [tests],
  );
  const preview = useMemo(() => {
    const placed = tests.some((t) => t.kind === "positionnement");
    return planFor(kindFor(today, placed), today, currentEstimates(graded));
  }, [tests, graded, today]);

  async function refresh(id: string) {
    const res = await fetch(`/api/formation/tcf/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { test?: TcfTest };
    if (json.test) upsert(json.test);
    return json.test ?? null;
  }

  /**
   * Suit la préparation : le serveur cherche les documents puis rédige chaque partie en arrière-plan.
   * L'écran lance au plus quatre parties à la fois et relit le test toutes les 5 secondes
   * (aucune requête ne reste ouverte longtemps : Safari sur iPad les coupe au bout d'une minute).
   */
  async function fill(first: TcfTest) {
    const asked = new Map<number, number>();
    const retried = new Set<number>();
    const until = clockNow() + 15 * 60_000;
    let test: TcfTest | null = first;
    const wait = () => new Promise((r) => setTimeout(r, 5_000));
    while (test && clockNow() < until) {
      setNow(clockNow());
      if (isReady(test)) return;
      if (!test.plan.researching_since) {
        const all = test.plan.sections.flatMap((sec) =>
          sec.parts.map((p) => p.idx),
        );
        const state = (i: number) => test!.parts[i]?.status;
        let running = all.filter((i) => state(i) === "en_cours").length;
        const failed = all.filter((i) => state(i) === "erreur");
        // Une partie en échec est relancée une fois ; ensuite on montre l'erreur.
        const stuck = failed.filter((i) => retried.has(i));
        if (
          stuck.length &&
          running === 0 &&
          all.every((i) => state(i) === "pret" || state(i) === "erreur")
        ) {
          const msg = test.parts[stuck[0]]?.error ?? "";
          setError(
            `${stuck.length} partie${stuck.length > 1 ? "s" : ""} n'${stuck.length > 1 ? "ont" : "a"} pas pu être préparée${stuck.length > 1 ? "s" : ""}. ${msg} Touchez « Continuer la préparation » pour réessayer.`.trim(),
          );
          return;
        }
        for (const i of all) {
          if (running >= 4) break;
          const st = state(i);
          const last = asked.get(i) ?? 0;
          // Une partie « en cours » depuis longtemps a pu être perdue : le serveur la reprend s'il le faut.
          const again =
            st === "erreur"
              ? !retried.has(i)
              : st === "en_cours"
                ? clockNow() - last > 6 * 60_000
                : st !== "pret" && clockNow() - last > 30_000;
          if (!again) continue;
          if (st === "erreur") retried.add(i);
          asked.set(i, clockNow());
          if (st !== "en_cours") running++;
          try {
            await fetch(
              `/api/formation/tcf/${encodeURIComponent(first.id)}/parts/${i}`,
              { method: "POST" },
            );
          } catch {
            /* réseau : on redemandera */
          }
        }
      } else if (
        clockNow() - new Date(test.plan.researching_since).getTime() >
        5.5 * 60_000
      ) {
        // Recherche interrompue côté serveur : la création du test la relance.
        try {
          await fetch("/api/formation/tcf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
        } catch {
          /* on réessaiera */
        }
      }
      await wait();
      try {
        test = (await refresh(first.id)) ?? test;
      } catch {
        /* réseau : on garde la dernière version */
      }
    }
    if (test && !isReady(test))
      setError(
        "La préparation prend plus de temps que prévu. Touchez « Continuer la préparation » dans quelques minutes.",
      );
  }

  async function prepare() {
    setBusy(true);
    setError(null);
    const t0 = clockNow();
    setStartedAt(t0);
    setNow(t0);
    try {
      let test = current;
      if (!test) {
        let json: { test?: TcfTest; error?: string } = {};
        let ok = false;
        try {
          const res = await fetch("/api/formation/tcf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          json = (await res.json().catch(() => ({}))) as typeof json;
          ok = res.ok;
        } catch {
          // Réponse perdue en route : le test a peut-être été créé quand même.
          const res = await fetch("/api/formation/tcf", {
            cache: "no-store",
          }).catch(() => null);
          const got = (await res?.json().catch(() => ({}))) as
            { tests?: TcfTest[] } | undefined;
          json = { test: got?.tests?.find((t) => t.status !== "corrige") };
          ok = !!json.test;
        }
        if (!ok || !json.test)
          throw new Error(
            json.error ??
              "Le test n'a pas pu être créé. Vérifiez la connexion et réessayez.",
          );
        test = json.test;
        upsert(test);
      }
      await fill(test);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La préparation a échoué.");
    } finally {
      setBusy(false);
    }
  }

  // ----- Passage ou correction d'une section -----
  if (screen.mode !== "home") {
    const test = tests.find((t) => t.id === screen.id);
    if (test) {
      const done = !!test.progress[String(screen.si)]?.result;
      const back = (
        <button
          type="button"
          className="btn btn-ghost btn-sm self-start"
          onClick={() => setScreen({ mode: "home" })}
        >
          <IconChevronLeft size={14} /> Tableau de bord
        </button>
      );
      return (
        <div className="flex flex-col gap-3">
          {back}
          {done || screen.mode === "result" ? (
            <>
              <SectionResults
                test={test}
                si={screen.si}
                setErrors={setErrors}
              />
              <button
                type="button"
                className="btn btn-primary self-center px-5"
                onClick={() => {
                  setScreen({ mode: "home" });
                  window.scrollTo({ top: 0 });
                }}
              >
                <IconChevronLeft size={16} /> Retour au tableau de bord
              </button>
            </>
          ) : (
            <TcfRunner
              test={test}
              si={screen.si}
              onUpdate={(t) => {
                upsert(t);
                if (t.progress[String(screen.si)]?.result)
                  setScreen({ mode: "result", id: t.id, si: screen.si });
              }}
              onExit={() => setScreen({ mode: "home" })}
            />
          )}
        </div>
      );
    }
  }

  const ready = current ? isReady(current) : false;
  const partsTotal = current
    ? current.plan.sections.reduce((s, x) => s + x.parts.length, 0)
    : 0;
  const partsReady = current
    ? Object.values(current.parts).filter((p) => p.status === "pret").length
    : 0;
  const elapsed = busy ? Math.max(0, now - startedAt) : 0;
  const wd = weekdayOf(today);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-bad-bg px-4 py-3 text-[13.5px] text-bad"
        >
          <IconAlert size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {/* ----- Test du jour ----- */}
      <section className="card overflow-hidden" aria-labelledby="tcf-today">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7">
          <div>
            <p className="eyebrow">Test du {fmtDay(today)}</p>
            <h3
              id="tcf-today"
              className="mt-0.5 font-display text-[20px] font-bold"
            >
              {current?.title ?? preview?.title ?? "Repos avant l'examen"}
            </h3>
            <p className="mt-1 text-[13px] text-muted">
              {(current?.kind ??
                (tests.some((t) => t.kind === "positionnement")
                  ? null
                  : "positionnement")) === "positionnement"
                ? "Pour mesurer votre niveau de départ dans chaque épreuve. Les tests suivants s'adapteront à ce niveau."
                : "En conditions réelles : chronomètre officiel, documents récents trouvés sur internet, questions calibrées sur votre niveau et un cran au-dessus."}
            </p>
          </div>
          {current?.status === "corrige" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-1 text-[12px] font-semibold text-ok">
              <IconCheck size={13} /> Terminé
            </span>
          )}
        </div>

        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(current ? current.plan.sections : (preview?.sections ?? [])).map(
            (s, si) => {
              const p = current?.progress[String(si)];
              const r = p?.result;
              const count = s.levels
                ? `${s.levels.length} questions`
                : `${s.tasks?.length} tâche${(s.tasks?.length ?? 0) > 1 ? "s" : ""}`;
              return (
                <li
                  key={si}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-7"
                >
                  <span className="mono flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[13px] font-bold">
                    {EPREUVE_SHORT[s.epreuve]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">
                      {EPREUVE_LABEL[s.epreuve]}
                    </span>
                    <span className="mono block text-[12px] text-muted">
                      {count} · {s.minutes} min
                      {s.levels
                        ? ` · ${s.levels[0]} → ${s.levels.at(-1)}`
                        : s.tasks
                          ? ` · tâche${s.tasks.length > 1 ? "s" : ""} ${s.tasks.join(", ")}`
                          : ""}
                    </span>
                  </span>
                  {r ? (
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2"
                      onClick={() =>
                        setScreen({ mode: "result", id: current!.id, si })
                      }
                    >
                      <LevelBadge level={r.level} />
                      <span className="mono text-[13px] font-semibold">
                        {r.value}
                        {unit(s.epreuve)}
                      </span>
                      <IconArrowRight size={14} className="text-muted" />
                    </button>
                  ) : current && ready && canEdit ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        setScreen({ mode: "run", id: current.id, si })
                      }
                    >
                      {p?.started_at ? "Reprendre" : "Commencer"}{" "}
                      <IconArrowRight size={14} />
                    </button>
                  ) : (
                    <span className="text-[12px] text-faint">
                      {current ? "en préparation" : "à préparer"}
                    </span>
                  )}
                </li>
              );
            },
          )}
        </ul>

        {!ready && canEdit && (
          <div className="flex flex-col gap-3 px-5 py-4 sm:px-7">
            {(busy || (current && partsTotal > 0)) && (
              <div>
                <div className="flex justify-between text-[12.5px] text-muted">
                  <span>
                    {!current
                      ? "Claude cherche des documents récents sur internet…"
                      : `Claude rédige les questions : ${partsReady}/${partsTotal} parties prêtes`}
                  </span>
                  {busy && (
                    <span className="mono">{`${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`}</span>
                  )}
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-signal transition-all"
                    style={{
                      width: `${current ? Math.max(6, (partsReady / Math.max(1, partsTotal)) * 100) : 4}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] text-muted">
                {busy
                  ? "Comptez 3 à 6 minutes. Vous pouvez laisser la page ouverte en arrière-plan."
                  : "Recherche de documents sur internet (1–2 min), puis rédaction des questions (2–4 min)."}
              </p>
              <button
                type="button"
                className="btn btn-primary px-5"
                onClick={() => void prepare()}
                disabled={busy || (!current && !preview)}
              >
                {busy ? (
                  <IconRefresh size={16} className="animate-spin" />
                ) : null}
                {busy
                  ? "Préparation…"
                  : current
                    ? "Continuer la préparation"
                    : "Préparer le test du jour"}
                {!busy && <IconArrowRight size={16} />}
              </button>
            </div>
          </div>
        )}

        {current && current.sources.length > 0 && (
          <details className="border-t border-line px-5 py-3 sm:px-7">
            <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-muted">
              <IconGlobe size={14} /> {current.sources.length} document
              {current.sources.length > 1 ? "s" : ""} consulté
              {current.sources.length > 1 ? "s" : ""} sur internet pour ce test
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-[13px]">
              {current.sources.slice(0, 15).map((s) => (
                <li key={s.url} className="truncate">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {s.title || s.url}{" "}
                    <IconExternal size={11} className="shrink-0 text-muted" />
                  </a>
                  <span className="text-faint">
                    {" "}
                    ·{" "}
                    {(() => {
                      try {
                        return new URL(s.url).hostname.replace(/^www\./, "");
                      } catch {
                        return "";
                      }
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {current?.summary?.bilan && (
          <p className="border-t border-line bg-surface-2 px-5 py-3 text-[13.5px] leading-relaxed whitespace-pre-line sm:px-7">
            {current.summary.bilan}
          </p>
        )}
      </section>

      <GoalPanel tests={graded} />

      {/* ----- Rotation ----- */}
      <section className="card p-4 sm:p-5" aria-labelledby="tcf-week">
        <h3 id="tcf-week" className="eyebrow mb-3">
          Rotation de la semaine · 30 à 45 min par jour
        </h3>
        <ol className="grid grid-cols-7 gap-1.5">
          {WEEK.map((d) => (
            <li
              key={d}
              className={`flex flex-col gap-1 rounded-xl px-1.5 py-2 text-center ${d === wd ? "bg-ink text-surface" : "bg-surface-2"}`}
            >
              <span
                className={`text-[11px] font-semibold ${d === wd ? "" : "text-muted"}`}
              >
                {DAY_SHORT[d]}
              </span>
              <span className="mono text-[11.5px] leading-tight font-bold">
                {d === 6
                  ? "Sam."
                  : ROTATION[d].epreuves.length
                    ? ROTATION[d].epreuves
                        .map((e) => EPREUVE_SHORT[e])
                        .join("+")
                    : "Faible"}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12px] text-muted">
          Samedi : examen blanc complet les semaines prévues par le programme (2
          h 50, faisable en plusieurs fois), sinon la compréhension la plus
          faible et une tâche 3. Dimanche : la compréhension la plus éloignée de
          l&apos;objectif. Chaque épreuve se fait dans le créneau du programme
          (Jour), puis les exercices du jour reprennent vos erreurs.
        </p>
      </section>

      {/* ----- Historique ----- */}
      {past.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="tcf-hist">
          <h3 id="tcf-hist" className="text-[15px] font-bold">
            Tests précédents
          </h3>
          <div className="card divide-y divide-line overflow-hidden">
            {past.map((t) => {
              const open = openHist === t.id;
              return (
                <article key={t.id}>
                  <button
                    type="button"
                    onClick={() => setOpenHist(open ? null : t.id)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-surface-2/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {t.title}
                      </span>
                      <span className="block text-[12px] text-muted first-letter:uppercase">
                        {fmtDay(t.day)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {t.plan.sections.map((s, si) => {
                        const r = t.progress[String(si)]?.result;
                        return (
                          <span
                            key={si}
                            className="mono inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[11.5px]"
                          >
                            <span className="font-bold">
                              {EPREUVE_SHORT[s.epreuve]}
                            </span>
                            {r ? (
                              <>
                                <span>{r.level}</span>
                                <span className="text-muted">{r.value}</span>
                              </>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </span>
                        );
                      })}
                    </span>
                    <IconChevronDown
                      size={16}
                      className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2/40 px-4 py-3">
                      {t.plan.sections.map((s, si) =>
                        t.progress[String(si)]?.result ? (
                          <button
                            key={si}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setScreen({ mode: "result", id: t.id, si })
                            }
                          >
                            Correction {EPREUVE_SHORT[s.epreuve]}{" "}
                            <IconArrowRight size={13} />
                          </button>
                        ) : isReady(t) && canEdit ? (
                          <button
                            key={si}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setScreen({ mode: "run", id: t.id, si })
                            }
                          >
                            Faire {EPREUVE_SHORT[s.epreuve]} maintenant{" "}
                            <IconArrowRight size={13} />
                          </button>
                        ) : null,
                      )}
                      {t.summary?.bilan && (
                        <p className="w-full pt-1 text-[13px] leading-relaxed whitespace-pre-line">
                          {t.summary.bilan}
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
      <p className="text-[11.5px] text-faint">
        Scores estimés : ils indiquent une tendance et ne remplacent pas un
        résultat officiel. Échelle {MAX_VALUE.co} points en compréhension,{" "}
        {MAX_VALUE.ee} en expression.
      </p>
    </div>
  );
}
