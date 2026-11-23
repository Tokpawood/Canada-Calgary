"use client";

import { UsageView } from "./UsageView";
import type { UsageRow } from "@/lib/aiUsage";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FORMATION_TODAY_EVENT,
  ERROR_REPEAT_THRESHOLD,
  IELTS_DATE,
  PROGRAM_END,
  PROGRAM_START,
  TCF,
  TCF_DATE,
  addDays,
  clampToProgram,
  dayPlan,
  daysBetween,
  keysUntil,
  phaseOf,
  programKeys,
  programOf,
  streak,
  weekKeys,
  weekOf,
  type DayItem,
  type ErrorEntry,
  type MemoEntry,
  type TrainingScore,
} from "@/lib/formation";
import { PageHeader } from "@/components/ui";
import {
  DarkHeader,
  DarkTiles,
  HeaderTabs,
  useHashTab,
} from "@/components/DarkHeader";
import { StatsRow } from "@/components/StatsRow";
import {
  IconBook,
  IconCalendar,
  IconCheck,
  IconGauge,
  IconPencil,
  IconRoute,
  IconShield,
  IconWallet,
} from "@/components/icons";
import { DayView } from "./DayView";
import { WeeksView } from "./WeeksView";
import { CalendarView } from "./CalendarView";
import { ScoresView } from "./ScoresView";
import { MethodView } from "./MethodView";
import { ErrorsView } from "./ErrorsView";
import { MemoView } from "./MemoView";
import { QuizView } from "./QuizView";
import { TcfView } from "./tcf/TcfView";
import type { TcfTest } from "@/lib/tcf";
import type { Quiz } from "@/lib/quiz";

const TABS = [
  "jour",
  "exercices",
  "tcf",
  "semaines",
  "calendrier",
  "carnet",
  "memo",
  "scores",
  "conso",
  "methode",
] as const;
type Tab = (typeof TABS)[number];

export function FormationBoard({
  dossierId,
  today,
  initialDone,
  initialScores,
  initialErrors,
  initialMemos,
  initialQuizzes,
  initialTests,
  usage,
  canEdit,
  initialDate,
  initialOpen,
}: {
  initialDate?: string;
  initialOpen?: string;
  dossierId: string;
  today: string;
  initialDone: string[];
  initialScores: TrainingScore[];
  initialErrors: ErrorEntry[];
  initialMemos: MemoEntry[];
  initialQuizzes: Quiz[];
  initialTests: TcfTest[];
  usage: UsageRow[];
  canEdit: boolean;
}) {
  const [done, setDone] = useState(() => new Set(initialDone));
  const [scores, setScores] = useState(initialScores);
  const [errors, setErrors] = useState(initialErrors);
  const [memos, setMemos] = useState(initialMemos);
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const todayQuiz = quizzes.find((q) => q.day === today);
  // Tests gardés ici (et non dans l'onglet) : changer d'onglet ne fait pas perdre un résultat tout juste obtenu.
  const [tests, setTests] = useState(initialTests);
  const todayTests = tests.filter((t) => t.day === today);
  /** Tâche du plan du jour déjà faite dans l'application (test TCF ou exercices du jour). */
  const toolDone = (it: DayItem): boolean => {
    if (it.tool === "exercices") return todayQuiz?.status === "corrige";
    if (it.tool !== "tcf" || !todayTests.length) return false;
    if (!it.epreuve) return todayTests.every((t) => t.status === "corrige");
    return todayTests.some((t) =>
      t.plan.sections.some(
        (s, si) => s.epreuve === it.epreuve && !!t.progress[String(si)]?.result,
      ),
    );
  };
  const [date, setDate] = useState(() => clampToProgram(initialDate ?? today));
  const [tab, setTab] = useHashTab<Tab>(TABS, "jour");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(initialOpen ?? null);

  // Lien d'une notification (/formation?d=…&t=…#jour) : une fois ouvert, on nettoie l'adresse.
  useEffect(() => {
    if (window.location.search)
      window.history.replaceState(
        null,
        "",
        `/formation${window.location.hash || "#jour"}`,
      );
  }, []);

  // Écritures enchaînées par case : deux touches rapides ne peuvent pas arriver dans le désordre.
  const queues = useRef(new Map<string, Promise<void>>());

  function toggle(key: string, v: boolean) {
    if (!canEdit) return;
    setSaveError(null);
    const flip = (on: boolean) =>
      setDone((s) => {
        const n = new Set(s);
        if (on) n.add(key);
        else n.delete(key);
        return n;
      });
    flip(v);
    const write = async () => {
      const supabase = createClient();
      const { error } = v
        ? await supabase
            .from("training_check")
            .upsert(
              { dossier_id: dossierId, item_key: key },
              { onConflict: "dossier_id,item_key", ignoreDuplicates: true },
            )
        : await supabase
            .from("training_check")
            .delete()
            .eq("dossier_id", dossierId)
            .eq("item_key", key);
      if (error) {
        flip(!v);
        setSaveError(
          "La case n'a pas pu être enregistrée. Vérifiez la connexion et réessayez.",
        );
      }
    };
    const next = (queues.current.get(key) ?? Promise.resolve()).then(write);
    queues.current.set(key, next);
  }

  function openDay(d: string) {
    setDate(d);
    setTab("jour");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const ref = clampToProgram(today);
  const program = programOf(ref) ?? TCF;
  const notStarted = today < PROGRAM_START;

  const stats = useMemo(() => {
    const keys = programKeys(program);
    const doneProg = keys.filter((k) => done.has(k)).length;
    const due = today > PROGRAM_START ? keysUntil(addDays(ref, -1)) : [];
    const late = due.filter((k) => !done.has(k)).length;
    const todayPlan = dayPlan(ref);
    const tDone = todayPlan?.items.filter((i) => done.has(i.key)).length ?? 0;
    const week = weekOf(ref);
    const wKeys = week ? weekKeys(week) : [];
    const wDone = wKeys.filter((k) => done.has(k)).length;
    return {
      pct: keys.length ? (doneProg / keys.length) * 100 : 0,
      doneProg,
      total: keys.length,
      late,
      today: { done: tDone, total: todayPlan?.items.length ?? 0 },
      week: {
        label: week
          ? `${week.prog === "tcf" ? "TCF" : "IELTS"} · semaine ${week.n}`
          : "Semaine",
        pct: wKeys.length ? (wDone / wKeys.length) * 100 : 0,
        done: wDone,
        total: wKeys.length,
      },
      streak: streak(today, done),
    };
  }, [done, today, ref, program]);

  // La pastille « actions du jour » de la barre latérale suit les cases cochées ici.
  useEffect(() => {
    const items = dayPlan(today)?.items;
    if (!items) return;
    const remaining = items.filter((i) => !done.has(i.key)).length;
    window.dispatchEvent(
      new CustomEvent(FORMATION_TODAY_EVENT, { detail: { remaining } }),
    );
  }, [done, today]);

  const phase = phaseOf(ref);
  const jTcf = daysBetween(today, TCF_DATE);
  const jIelts = daysBetween(today, IELTS_DATE);
  const span = daysBetween(PROGRAM_START, PROGRAM_END);
  const elapsedPct = Math.min(
    100,
    Math.max(0, (daysBetween(PROGRAM_START, today) / span) * 100),
  );
  const tcfPct = (daysBetween(PROGRAM_START, TCF_DATE) / span) * 100;
  const countdown = (n: number) =>
    n > 0 ? `J-${n}` : n === 0 ? "Aujourd'hui" : "Passé";
  const targets = errors.filter(
    (e) => !e.mastered && e.count >= ERROR_REPEAT_THRESHOLD,
  ).length;

  return (
    <>
      <PageHeader
        title="Formation TCF · IELTS"
        description="TCF Canada du 16 novembre au 15 février, puis IELTS General Training du 16 février au 27 mars. Cochez chaque tâche une fois faite."
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              {
                label: "TCF Canada · 15 févr.",
                value: countdown(jTcf),
                sub: "Objectif NCLC 10",
                tone: jTcf < 0 ? "ok" : "signal",
              },
              {
                label: "IELTS · 27 mars",
                value: countdown(jIelts),
                sub: "Objectif CLB 9",
                tone: jIelts < 0 ? "ok" : "signal",
              },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Sections de la formation"
            active={tab}
            onSelect={setTab}
            tabs={[
              {
                id: "jour",
                label: "Jour",
                icon: <IconCheck size={15} />,
                badge: stats.today.total
                  ? {
                      text: `${stats.today.done}/${stats.today.total}`,
                      tone:
                        stats.today.done === stats.today.total ? "ok" : "plain",
                    }
                  : null,
              },
              {
                id: "exercices",
                label: "Exercices du jour",
                icon: <IconGauge size={15} />,
                badge:
                  todayQuiz?.status === "corrige"
                    ? {
                        text: `${todayQuiz.score}/${todayQuiz.total}`,
                        tone: "ok",
                      }
                    : todayQuiz
                      ? { text: "à finir", tone: "signal" }
                      : { text: "nouveau", tone: "signal" },
              },
              {
                id: "tcf",
                label: "TCF Canada",
                icon: <IconShield size={15} />,
                badge:
                  todayTests.length &&
                  todayTests.every((t) => t.status === "corrige")
                    ? { text: "fait", tone: "ok" }
                    : { text: "du jour", tone: "signal" },
              },
              {
                id: "semaines",
                label: "Semaines",
                icon: <IconRoute size={15} />,
              },
              {
                id: "calendrier",
                label: "Calendrier",
                icon: <IconCalendar size={15} />,
              },
              {
                id: "carnet",
                label: "Carnet d'erreurs",
                icon: <IconPencil size={15} />,
                badge: targets
                  ? { text: String(targets), tone: "signal" }
                  : errors.length
                    ? { text: String(errors.length) }
                    : null,
              },
              {
                id: "memo",
                label: "Aide-mémoire",
                icon: <IconBook size={15} />,
                badge: memos.length ? { text: String(memos.length) } : null,
              },
              {
                id: "scores",
                label: "Scores",
                icon: <IconGauge size={15} />,
                badge: scores.length ? { text: String(scores.length) } : null,
              },
              ...(canEdit
                ? [
                    {
                      id: "conso" as const,
                      label: "Consommation",
                      icon: <IconWallet size={15} />,
                    },
                  ]
                : []),
              {
                id: "methode",
                label: "Méthode et ressources",
                icon: <IconBook size={15} />,
              },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          {notStarted
            ? "Début lundi 16 novembre"
            : phase
              ? `${program.name} · phase ${phase.n} · ${phase.name}`
              : "Formation terminée"}
        </p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {Math.round(stats.pct)}
          <span className="ml-1 text-[24px] text-signal">%</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          du programme {program.id === "tcf" ? "TCF" : "IELTS"} coché ·{" "}
          <span className="mono text-night-ink">{stats.doneProg}</span> tâche
          {stats.doneProg > 1 ? "s" : ""} sur {stats.total}
          {phase && !notStarted && <> · objectif de phase : {phase.goal}</>}
        </p>
        <div className="relative mt-5" aria-hidden>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-signal"
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          <span
            className="absolute -top-1 h-[18px] w-0.5 rounded bg-night-ink"
            style={{ left: `${tcfPct}%` }}
          />
          <span className="absolute -top-1 right-0 h-[18px] w-0.5 rounded bg-night-ink" />
        </div>
        <div className="mono relative mt-2 h-4 text-[10.5px] text-night-muted">
          <span className="absolute left-0">16/11</span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${tcfPct}%` }}
          >
            TCF 15/02
          </span>
          <span className="absolute right-0">IELTS 27/03</span>
        </div>
      </DarkHeader>

      <StatsRow
        stats={[
          {
            label: "Aujourd'hui",
            value: `${stats.today.done}/${stats.today.total}`,
            sub: notStarted ? "programme du 16/11" : "tâches du jour",
            pct: stats.today.total
              ? (stats.today.done / stats.today.total) * 100
              : 0,
            tone:
              stats.today.done === stats.today.total && stats.today.total
                ? "ok"
                : "act",
          },
          {
            label: stats.week.label,
            value: `${Math.round(stats.week.pct)}`,
            unit: "%",
            sub: `${stats.week.done} sur ${stats.week.total} tâches et envois`,
            pct: stats.week.pct,
          },
          {
            label: "En retard",
            value: String(stats.late),
            sub: stats.late
              ? "tâches non cochées des jours passés"
              : "aucun retard",
            valueTone: stats.late ? "bad" : "ok",
          },
          {
            label: "Série",
            value: String(stats.streak),
            unit: stats.streak > 1 ? "jours" : "jour",
            sub: "jours complets d'affilée",
          },
        ]}
      />

      {canEdit && tab === "jour" && (
        <p className="mb-4 text-[12.5px] text-muted">
          Touchez une tâche pour sa méthode et ses ressources.{" "}
          <a
            href="/compte#notifications"
            className="font-semibold text-ink underline underline-offset-2"
          >
            Régler les rappels
          </a>
        </p>
      )}
      {!canEdit && (
        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
          Lecture seule : seul le titulaire peut cocher les tâches, noter ses
          erreurs et ajouter ses scores.
        </p>
      )}
      {saveError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad"
        >
          {saveError}
        </p>
      )}

      <div role="tabpanel">
        {tab === "jour" && (
          <DayView
            date={date}
            today={today}
            onDate={(d) => {
              setOpenKey(null);
              setDate(d);
            }}
            done={done}
            toggle={toggle}
            openKey={openKey}
            onOpen={setOpenKey}
            canEdit={canEdit}
            onTool={(t) => setTab(t === "tcf" ? "tcf" : "exercices")}
            toolDone={toolDone}
          />
        )}
        {tab === "exercices" && (
          <QuizView
            quizzes={quizzes}
            setQuizzes={setQuizzes}
            setErrors={setErrors}
            today={today}
            canEdit={canEdit}
          />
        )}
        {tab === "tcf" && (
          <TcfView
            tests={tests}
            setTests={setTests}
            setErrors={setErrors}
            today={today}
            canEdit={canEdit}
          />
        )}
        {tab === "conso" && canEdit && <UsageView rows={usage} today={today} />}
        {tab === "semaines" && (
          <WeeksView
            today={today}
            done={done}
            toggle={toggle}
            onOpenDay={openDay}
            canEdit={canEdit}
          />
        )}
        {tab === "calendrier" && (
          <CalendarView today={today} done={done} onOpenDay={openDay} />
        )}
        {tab === "carnet" && (
          <ErrorsView
            dossierId={dossierId}
            errors={errors}
            setErrors={setErrors}
            defaultExam={program.id}
            canEdit={canEdit}
          />
        )}
        {tab === "memo" && (
          <MemoView
            dossierId={dossierId}
            memos={memos}
            setMemos={setMemos}
            defaultExam={program.id}
            canEdit={canEdit}
          />
        )}
        {tab === "scores" && (
          <ScoresView
            dossierId={dossierId}
            scores={scores}
            setScores={setScores}
            today={today}
            canEdit={canEdit}
          />
        )}
        {tab === "methode" && <MethodView />}
      </div>
    </>
  );
}
