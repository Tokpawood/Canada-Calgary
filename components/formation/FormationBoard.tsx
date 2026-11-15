"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IELTS_DATE,
  PROGRAM_END,
  PROGRAM_START,
  TCF_DATE,
  addDays,
  allKeys,
  clampToProgram,
  dayPlan,
  daysBetween,
  keysUntil,
  phaseOf,
  streak,
  weekKeys,
  weekOf,
  type TrainingScore,
} from "@/lib/formation";
import { PageHeader } from "@/components/ui";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";
import { StatsRow } from "@/components/StatsRow";
import { IconBook, IconCalendar, IconCheck, IconGauge, IconRoute } from "@/components/icons";
import { DayView } from "./DayView";
import { WeeksView } from "./WeeksView";
import { CalendarView } from "./CalendarView";
import { ScoresView } from "./ScoresView";
import { MethodView } from "./MethodView";

const TABS = ["jour", "semaines", "calendrier", "scores", "methode"] as const;
type Tab = (typeof TABS)[number];

export function FormationBoard({
  dossierId,
  today,
  initialDone,
  initialScores,
  canEdit,
}: {
  dossierId: string;
  today: string;
  initialDone: string[];
  initialScores: TrainingScore[];
  canEdit: boolean;
}) {
  const [done, setDone] = useState(() => new Set(initialDone));
  const [scores, setScores] = useState(initialScores);
  const [date, setDate] = useState(() => clampToProgram(today));
  const [tab, setTab] = useHashTab<Tab>(TABS, "jour");
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: string, v: boolean) {
    if (!canEdit) return;
    setError(null);
    setDone((s) => {
      const n = new Set(s);
      if (v) n.add(key);
      else n.delete(key);
      return n;
    });
    const supabase = createClient();
    const { error: err } = v
      ? await supabase.from("training_check").upsert({ dossier_id: dossierId, item_key: key }, { onConflict: "dossier_id,item_key", ignoreDuplicates: true })
      : await supabase.from("training_check").delete().eq("dossier_id", dossierId).eq("item_key", key);
    if (err) {
      setDone((s) => {
        const n = new Set(s);
        if (v) n.delete(key);
        else n.add(key);
        return n;
      });
      setError("La case n'a pas pu être enregistrée. Vérifiez la connexion et réessayez.");
    }
  }

  function openDay(d: string) {
    setDate(d);
    setTab("jour");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const stats = useMemo(() => {
    const all = allKeys();
    const doneAll = all.filter((k) => done.has(k)).length;
    const ref = clampToProgram(today);
    const started = today >= PROGRAM_START;
    const due = started ? keysUntil(addDays(ref, -1)) : [];
    const late = due.filter((k) => !done.has(k)).length;
    const todayPlan = dayPlan(ref);
    const tDone = todayPlan?.items.filter((i) => done.has(i.key)).length ?? 0;
    const week = weekOf(ref);
    const wKeys = week ? weekKeys(week) : [];
    const wDone = wKeys.filter((k) => done.has(k)).length;
    return {
      pct: all.length ? (doneAll / all.length) * 100 : 0,
      doneAll,
      total: all.length,
      late,
      today: { done: tDone, total: todayPlan?.items.length ?? 0 },
      week: { n: week?.n ?? null, pct: wKeys.length ? (wDone / wKeys.length) * 100 : 0, done: wDone, total: wKeys.length },
      streak: streak(today, done),
    };
  }, [done, today]);

  const phase = phaseOf(clampToProgram(today));
  const jIelts = daysBetween(today, IELTS_DATE);
  const jTcf = daysBetween(today, TCF_DATE);
  const span = daysBetween(PROGRAM_START, PROGRAM_END);
  const elapsedPct = Math.min(100, Math.max(0, (daysBetween(PROGRAM_START, today) / span) * 100));
  const ieltsPct = (daysBetween(PROGRAM_START, IELTS_DATE) / span) * 100;
  const notStarted = today < PROGRAM_START;

  const countdown = (n: number) => (n > 0 ? `J-${n}` : n === 0 ? "Aujourd'hui" : "Passé");

  return (
    <>
      <PageHeader
        title="Formation TCF · IELTS"
        description="Programme du 16 novembre 2026 au 15 février 2027 : emploi du temps du jour, semaines, envois à Claude et scores. Cochez chaque tâche une fois faite."
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              { label: "IELTS · 30 janv.", value: countdown(jIelts), sub: "Objectif CLB 9", tone: jIelts < 0 ? "ok" : "signal" },
              { label: "TCF Canada · 15 févr.", value: countdown(jTcf), sub: "Objectif NCLC 10", tone: jTcf < 0 ? "ok" : "signal" },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Sections de la formation"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "jour", label: "Jour", icon: <IconCheck size={15} />, badge: stats.today.total ? { text: `${stats.today.done}/${stats.today.total}`, tone: stats.today.done === stats.today.total ? "ok" : "plain" } : null },
              { id: "semaines", label: "Semaines", icon: <IconRoute size={15} /> },
              { id: "calendrier", label: "Calendrier", icon: <IconCalendar size={15} /> },
              { id: "scores", label: "Scores", icon: <IconGauge size={15} />, badge: scores.length ? { text: String(scores.length) } : null },
              { id: "methode", label: "Méthode et ressources", icon: <IconBook size={15} /> },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
          {notStarted ? "Début lundi 16 novembre" : phase ? `Phase ${phase.n} · ${phase.name}` : "Programme terminé"}
        </p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {Math.round(stats.pct)}
          <span className="ml-1 text-[24px] text-signal">%</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          du programme coché · <span className="mono text-night-ink">{stats.doneAll}</span> tâche{stats.doneAll > 1 ? "s" : ""} sur {stats.total}
          {phase && !notStarted && <> · objectif de phase : {phase.goal}</>}
        </p>
        <div className="relative mt-5" aria-hidden>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-signal" style={{ width: `${elapsedPct}%` }} />
          </div>
          <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-night-ink" style={{ left: `${ieltsPct}%` }} />
          <span className="absolute -top-1 right-0 h-[18px] w-0.5 rounded bg-night-ink" />
        </div>
        <div className="mono relative mt-2 h-4 text-[10.5px] text-night-muted">
          <span className="absolute left-0">16/11</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${ieltsPct}%` }}>
            IELTS 30/01
          </span>
          <span className="absolute right-0">TCF 15/02</span>
        </div>
      </DarkHeader>

      <StatsRow
        stats={[
          { label: "Aujourd'hui", value: `${stats.today.done}/${stats.today.total}`, sub: notStarted ? "programme du 16/11" : "tâches du jour", pct: stats.today.total ? (stats.today.done / stats.today.total) * 100 : 0, tone: stats.today.done === stats.today.total && stats.today.total ? "ok" : "act" },
          { label: stats.week.n ? `Semaine ${stats.week.n}` : "Semaine", value: `${Math.round(stats.week.pct)}`, unit: "%", sub: `${stats.week.done} sur ${stats.week.total} tâches et envois`, pct: stats.week.pct },
          { label: "En retard", value: String(stats.late), sub: stats.late ? "tâches non cochées des jours passés" : "aucun retard", valueTone: stats.late ? "bad" : "ok" },
          { label: "Série", value: String(stats.streak), unit: stats.streak > 1 ? "jours" : "jour", sub: "jours complets d'affilée" },
        ]}
      />

      {!canEdit && <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">Lecture seule : seul le titulaire peut cocher les tâches.</p>}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}

      <div role="tabpanel">
        {tab === "jour" && <DayView date={date} today={today} onDate={setDate} done={done} toggle={toggle} />}
        {tab === "semaines" && <WeeksView today={today} done={done} toggle={toggle} onOpenDay={openDay} />}
        {tab === "calendrier" && <CalendarView today={today} done={done} onOpenDay={openDay} />}
        {tab === "scores" && <ScoresView dossierId={dossierId} scores={scores} setScores={setScores} today={today} />}
        {tab === "methode" && <MethodView />}
      </div>
    </>
  );
}

