"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { daysUntil, isLate, isOpenStep, nextOpenStep, overallProgress, phaseProgress } from "@/lib/rules";
import type { Step } from "@/lib/types";
import { newId } from "@/lib/ids";
import { Chip, EmptyState, STEP_TONE, dueInfo, fcfa } from "@/components/ui";
import { IconAlert, IconArrowRight, IconCalendar, IconCheck, IconChevronDown, IconLink, IconPlus, IconRoute } from "@/components/icons";
import { FilterBar, FilterChip, FilterGroup } from "@/components/FilterBar";
import { StatsRow, type Stat } from "@/components/StatsRow";
import { Hero } from "@/components/Hero";
import { StepDrawer } from "./StepDrawer";

type FilterKey = "upcoming" | "late" | "done" | "all";
/** "apercu", "toutes" ou l'index de la phase (0, 1, 2…). */
type TabKey = "apercu" | "toutes" | number;

const shortPhase = (p: string) => p.replace(/^\d+\.\s*/, "");

function tabToHash(t: TabKey) {
  return typeof t === "number" ? `phase-${t + 1}` : t;
}

interface Props {
  initialSteps: Step[];
  fundsStat: Stat;
  profileDate: string | null;
}

export function ParcoursBoard({ initialSteps, fundsStat, profileDate }: Props) {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [tab, setTab] = useState<TabKey>("apercu");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newPhase, setNewPhase] = useState(initialSteps[0]?.phase ?? "1. Mise en ordre");
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const supabase = createClient();

  const phases = useMemo(() => phaseProgress(steps), [steps]);
  const phaseCount = phases.length;

  // L'onglet suit l'ancre de l'URL (#apercu, #phase-2, #toutes).
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      const m = /^phase-(\d+)$/.exec(h);
      if (m && Number(m[1]) >= 1 && Number(m[1]) <= phaseCount) setTab(Number(m[1]) - 1);
      else if (h === "toutes" || h === "apercu") setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [phaseCount]);

  function selectTab(t: TabKey) {
    setTab(t);
    setFilter(t === "toutes" ? "upcoming" : "all");
    setQuery("");
    setAdding(false);
    if (typeof t === "number" && phases[t]) setNewPhase(phases[t].phase);
    window.history.replaceState(null, "", `#${tabToHash(t)}`);
  }

  const dueSorted = useMemo(
    () =>
      [...steps].sort((a, b) => {
        const da = a.due ? new Date(a.due).getTime() : Infinity;
        const db = b.due ? new Date(b.due).getTime() : Infinity;
        return da - db;
      }),
    [steps],
  );

  const activePhase = typeof tab === "number" ? phases[tab]?.phase ?? null : null;
  const scope = useMemo(() => (activePhase ? steps.filter((s) => s.phase === activePhase) : steps), [steps, activePhase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scope.filter((s) => {
      if (filter === "late" && !isLate(s)) return false;
      if (filter === "done" && s.status !== "Fait") return false;
      if (filter === "upcoming" && !isOpenStep(s.status)) return false;
      if (q && !`${s.title} ${s.org} ${s.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scope, filter, query]);

  const counts: Record<FilterKey, number> = {
    upcoming: scope.filter((s) => isOpenStep(s.status)).length,
    late: scope.filter((s) => isLate(s)).length,
    done: scope.filter((s) => s.status === "Fait").length,
    all: scope.length,
  };

  // Indicateurs globaux, recalculés en direct à chaque modification.
  const overallPct = Math.round(overallProgress(steps) * 100);
  const next = nextOpenStep(steps);
  const done = steps.filter((s) => s.status === "Fait").length;
  const counted = steps.filter((s) => s.status !== "Si nécessaire").length;
  const lateSteps = dueSorted.filter((s) => isLate(s));
  const soonSteps = dueSorted.filter((s) => {
    if (!isOpenStep(s.status) || isLate(s)) return false;
    const d = daysUntil(s.due);
    return d != null && d >= 0 && d <= 30;
  });
  const totalPlanned = steps.reduce((sum, s) => sum + (s.planned ?? 0), 0);
  const totalActual = steps.reduce((sum, s) => sum + (s.actual ?? 0), 0);
  const countdown = daysUntil(profileDate);

  const stats: Stat[] = [
    { label: "Étapes faites", value: `${done}`, unit: `/ ${counted}`, sub: `${steps.length - counted} étape(s) facultative(s)`, pct: counted ? (done / counted) * 100 : 0, tone: "ok" },
    {
      label: "En retard",
      value: `${lateSteps.length}`,
      sub: lateSteps.length ? "échéance(s) dépassée(s)" : "toutes les échéances tenues",
      valueTone: lateSteps.length ? "bad" : "ok",
    },
    fundsStat,
    {
      label: "Dépenses payées",
      value: fcfa(totalActual),
      unit: "F",
      sub: totalPlanned > 0 ? `sur ${fcfa(totalPlanned)} F prévus` : "aucun montant prévu",
      pct: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
    },
  ];

  const selected = steps.find((s) => s.id === selectedId) ?? null;
  const selectedPosition = selected ? dueSorted.findIndex((s) => s.id === selected.id) + 1 : 0;

  function updateStep(updated: Step) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function navigate(direction: "prev" | "next") {
    if (!selected) return;
    const idx = dueSorted.findIndex((s) => s.id === selected.id);
    const target = dueSorted[direction === "prev" ? idx - 1 : idx + 1];
    if (target) setSelectedId(target.id);
  }

  async function addStep() {
    const title = newTitle.trim();
    if (!title) return;
    const dossierId = steps[0]?.dossierId;
    if (!dossierId) return;
    const id = newId("s");
    const position = steps.length;
    const due = newDue || null;
    const { error } = await supabase
      .from("step")
      .insert({ id, dossier_id: dossierId, phase: newPhase, title, due, status: "À faire", org: "", req: "", notes: "", risk: "", position });
    if (!error) {
      setSteps((prev) => [
        ...prev,
        { id, dossierId, phase: newPhase, title, due, status: "À faire", planned: null, actual: null, org: "", req: "", notes: "", risk: "", position, tasks: [], links: [] },
      ]);
      setNewTitle("");
      setNewDue("");
      setAdding(false);
      setSelectedId(id);
    }
  }

  const tabs: Array<{ key: TabKey; label: ReactNode; title?: string }> = [
    { key: "apercu", label: "Vue d'ensemble" },
    ...phases.map((p, i) => ({
      key: i as TabKey,
      title: p.phase,
      label: (
        <>
          <span className="mono">{i + 1}.</span>
          <span className="max-w-[150px] truncate">{shortPhase(p.phase)}</span>
        </>
      ),
    })),
    { key: "toutes", label: "Toutes les étapes" },
  ];

  const filterBar = (
    <FilterBar
      query={query}
      onQuery={setQuery}
      placeholder={activePhase ? `Rechercher dans « ${shortPhase(activePhase)} »…` : "Rechercher une étape, un organisme, une note…"}
      searchLabel="Rechercher une étape"
      actions={
        <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-sm btn-primary" aria-expanded={adding}>
          <IconPlus size={15} />
          <span className="hidden sm:inline">Étape</span>
        </button>
      }
      meta={filtered.length === scope.length ? `${scope.length} étapes` : `${filtered.length} sur ${scope.length}`}
      onReset={
        filter !== (tab === "toutes" ? "upcoming" : "all") || query
          ? () => {
              setFilter(tab === "toutes" ? "upcoming" : "all");
              setQuery("");
            }
          : undefined
      }
    >
      <FilterGroup label="Filtrer les étapes">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" count={counts.all} />
        <FilterChip active={filter === "upcoming"} onClick={() => setFilter("upcoming")} label="À venir" count={counts.upcoming} />
        <FilterChip active={filter === "late"} onClick={() => setFilter("late")} label="En retard" count={counts.late} alert />
        <FilterChip active={filter === "done"} onClick={() => setFilter("done")} label="Faites" count={counts.done} />
      </FilterGroup>
    </FilterBar>
  );

  const addForm = adding && (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void addStep();
      }}
      className="card anim-fade mb-4 grid gap-3 p-4 sm:grid-cols-[200px_minmax(0,1fr)_160px_auto] sm:items-end"
    >
      <label>
        <span className="field-label">Phase</span>
        <select value={newPhase} onChange={(e) => setNewPhase(e.target.value)} className="input">
          {phases.map((p) => (
            <option key={p.phase} value={p.phase}>
              {p.phase}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">Intitulé</span>
        <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex. Prendre rendez-vous pour la biométrie" className="input" />
      </label>
      <label>
        <span className="field-label">Échéance</span>
        <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="input" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost">
          Annuler
        </button>
        <button type="submit" disabled={!newTitle.trim()} className="btn btn-primary">
          Ajouter
        </button>
      </div>
    </form>
  );

  const emptyList = (
    <EmptyState icon={<IconRoute size={20} />} title={filter === "late" ? "Aucune étape en retard" : "Aucune étape à afficher"}>
      {query ? "Aucun résultat pour cette recherche." : filter === "late" ? "Toutes les échéances sont tenues." : "Changez de filtre pour voir d'autres étapes."}
    </EmptyState>
  );

  return (
    <div>
      <Hero
        phases={phases}
        overallPct={overallPct}
        done={done}
        counted={counted}
        late={lateSteps.length}
        countdown={countdown}
        activePhase={typeof tab === "number" ? tab : -1}
        onPhase={(i) => selectTab(i)}
        onOpenNext={next ? () => setSelectedId(next.id) : undefined}
        nextStep={
          next
            ? {
                title: next.title,
                due: next.due,
                daysLeft: daysUntil(next.due),
                phase: next.phase,
                org: next.org,
                tasksDone: next.tasks.filter((t) => t.done).length,
                tasksTotal: next.tasks.length,
              }
            : null
        }
      >
        <div role="tablist" aria-label="Phases du parcours" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto px-3 sm:px-5">
          {tabs.map((t) => {
            const on = tab === t.key;
            const p = typeof t.key === "number" ? phases[t.key] : null;
            return (
              <button
                key={String(t.key)}
                type="button"
                role="tab"
                aria-selected={on}
                title={t.title}
                onClick={() => selectTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  on ? "bg-white/10 text-night-ink shadow-[inset_0_-2px_0_var(--signal)]" : "text-night-muted hover:bg-white/5 hover:text-night-ink"
                }`}
              >
                {t.label}
                {p && (
                  <span
                    className={`mono rounded-full px-1.5 text-[10.5px] leading-[18px] ${
                      on ? "bg-white/20 text-night-ink" : p.pct === 100 ? "bg-signal text-black" : "bg-white/15 text-night-ink"
                    }`}
                  >
                    {p.pct === 100 ? "✓" : `${p.pct}%`}
                  </span>
                )}
                {t.key === "apercu" && lateSteps.length > 0 && (
                  <span className={`mono rounded-full px-1.5 text-[10.5px] leading-[18px] ${"bg-bad text-white"}`}>{lateSteps.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </Hero>

      <div className="mt-5" role="tabpanel">
        {tab === "apercu" && (
          <div className="flex flex-col gap-5">
            <StatsRow stats={stats} className="" />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ListCard
                icon={<IconAlert size={16} />}
                tone="bad"
                title="En retard"
                sub="Échéance dépassée, à traiter en priorité."
                count={lateSteps.length}
                empty="Aucune étape en retard. Bravo !"
              >
                {lateSteps.slice(0, 6).map((s) => (
                  <StepRow key={s.id} step={s} onSelect={() => setSelectedId(s.id)} showPhase />
                ))}
              </ListCard>
              <ListCard
                icon={<IconCalendar size={16} />}
                title="Dans les 30 prochains jours"
                sub="Les échéances qui arrivent."
                count={soonSteps.length}
                empty="Aucune échéance dans les 30 prochains jours."
              >
                {soonSteps.slice(0, 6).map((s) => (
                  <StepRow key={s.id} step={s} onSelect={() => setSelectedId(s.id)} showPhase />
                ))}
              </ListCard>
            </div>

            <div>
              <h2 className="mb-3 text-[17px] font-bold">Phases</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {phases.map((p, i) => (
                  <PhaseCard key={p.phase} index={i} phase={p.phase} pct={p.pct} steps={dueSorted.filter((s) => s.phase === p.phase)} onOpen={() => selectTab(i)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {typeof tab === "number" && activePhase && (
          <div className="flex flex-col gap-4">
            <PhaseHeader index={tab} phase={activePhase} pct={phases[tab].pct} steps={scope} />
            {filterBar}
            {addForm}
            {filtered.length === 0 ? (
              emptyList
            ) : (
              <section className="card overflow-hidden">
                <ul className="[&>li:first-child]:border-t-0">
                  {dueSorted
                    .filter((s) => filtered.includes(s))
                    .map((s) => (
                      <StepRow key={s.id} step={s} onSelect={() => setSelectedId(s.id)} />
                    ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "toutes" && (
          <div className="flex flex-col gap-4">
            {filterBar}
            {addForm}
            {filtered.length === 0 && emptyList}
            {phases
              .filter(({ phase }) => filtered.some((s) => s.phase === phase))
              .map(({ phase, pct }) => {
                const rows = dueSorted.filter((s) => s.phase === phase && filtered.includes(s));
                const all = steps.filter((s) => s.phase === phase);
                const doneCount = all.filter((s) => s.status === "Fait").length;
                const isCollapsed = collapsed[phase] ?? false;
                const phaseIndex = phases.findIndex((p) => p.phase === phase) + 1;
                return (
                  <section key={phase} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [phase]: !isCollapsed }))}
                      aria-expanded={!isCollapsed}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60 sm:px-5"
                    >
                      <PhaseBadge index={phaseIndex - 1} pct={pct} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="truncate text-[16px] font-bold">{shortPhase(phase)}</h3>
                          <span className="mono shrink-0 text-[12px] text-muted">
                            {doneCount}/{all.length} · {pct} %
                          </span>
                        </div>
                        <div className="mt-2 h-1 rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <IconChevronDown size={18} className={`shrink-0 text-faint transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                    </button>
                    {!isCollapsed && (
                      <ul>
                        {rows.map((s) => (
                          <StepRow key={s.id} step={s} onSelect={() => setSelectedId(s.id)} />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
          </div>
        )}
      </div>

      {selected && (
        <StepDrawer
          key={selected.id}
          step={selected}
          position={selectedPosition}
          total={steps.length}
          phases={phases.map((p) => p.phase)}
          onChange={updateStep}
          onDelete={() => {
            setSteps((prev) => prev.filter((s) => s.id !== selected.id));
            setSelectedId(null);
          }}
          onNavigate={navigate}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function PhaseBadge({ index, pct, size = "md" }: { index: number; pct: number; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-11 w-11 text-[16px] rounded-xl" : "h-8 w-8 text-[13px] rounded-full";
  return (
    <span className={`mono grid shrink-0 place-items-center font-bold ${dim} ${pct === 100 ? "bg-ok text-surface" : "bg-act-soft text-act"}`}>
      {pct === 100 ? <IconCheck size={size === "lg" ? 18 : 15} /> : index + 1}
    </span>
  );
}

function phaseFacts(steps: Step[]) {
  const done = steps.filter((s) => s.status === "Fait").length;
  const late = steps.filter((s) => isLate(s)).length;
  const planned = steps.reduce((sum, s) => sum + (s.planned ?? 0), 0);
  const actual = steps.reduce((sum, s) => sum + (s.actual ?? 0), 0);
  const dues = steps.map((s) => s.due).filter((d): d is string => !!d).sort();
  return { done, late, planned, actual, first: dues[0] ?? null, last: dues[dues.length - 1] ?? null };
}

function fmtShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function PhaseHeader({ index, phase, pct, steps }: { index: number; phase: string; pct: number; steps: Step[] }) {
  const f = phaseFacts(steps);
  const facts = [
    { label: "Étapes faites", value: `${f.done}/${steps.length}` },
    { label: "En retard", value: String(f.late), bad: f.late > 0 },
    { label: "Période", value: f.first ? `${fmtShort(f.first)} → ${fmtShort(f.last)}` : "—" },
    { label: "Coût", value: f.planned || f.actual ? `${fcfa(f.actual)} / ${fcfa(f.planned)} F` : "—" },
  ];
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <PhaseBadge index={index} pct={pct} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Phase {index + 1}</p>
          <h2 className="truncate text-[19px] font-bold">{shortPhase(phase)}</h2>
        </div>
        <span className="mono text-[26px] leading-none font-semibold">
          {pct}
          <span className="text-[14px] text-muted"> %</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {facts.map((x) => (
          <div key={x.label} className="min-w-0">
            <dt className="text-[11.5px] text-muted">{x.label}</dt>
            <dd className={`mono m-0 mt-0.5 truncate text-[13.5px] font-semibold ${x.bad ? "text-bad" : ""}`}>{x.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PhaseCard({ index, phase, pct, steps, onOpen }: { index: number; phase: string; pct: number; steps: Step[]; onOpen: () => void }) {
  const f = phaseFacts(steps);
  const nextStep = steps.find((s) => isOpenStep(s.status));
  return (
    <button type="button" onClick={onOpen} className="card group flex flex-col p-4 text-left transition-colors hover:border-faint">
      <div className="flex items-center gap-3">
        <PhaseBadge index={index} pct={pct} />
        <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-bold" title={phase}>
          {shortPhase(phase)}
        </h3>
        <IconArrowRight size={15} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="h-1 flex-1 rounded-full bg-surface-2">
          <span className="block h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
        </span>
        <span className="mono text-[11.5px] text-muted">
          {f.done}/{steps.length}
        </span>
      </div>
      <div className="mt-3 border-t border-line pt-2.5 text-[12px]">
        {nextStep ? (
          <p className="truncate text-muted">
            <span className="text-faint">Suivante : </span>
            <span className="font-semibold text-ink">{nextStep.title}</span>
          </p>
        ) : (
          <p className="font-semibold text-ok">Phase terminée</p>
        )}
        {f.late > 0 && <p className="mt-1 font-semibold text-bad">{f.late} en retard</p>}
      </div>
    </button>
  );
}

function ListCard({
  icon,
  tone,
  title,
  sub,
  count,
  empty,
  children,
}: {
  icon: ReactNode;
  tone?: "bad";
  title: string;
  sub: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone === "bad" && count ? "bg-bad-bg text-bad" : "bg-surface-2 text-muted"}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <p className="text-[12px] text-muted">{sub}</p>
        </div>
        <span className="mono text-[13px] font-semibold text-muted">{count}</span>
      </div>
      {count === 0 ? <p className="border-t border-line px-4 py-6 text-center text-[13px] text-muted sm:px-5">{empty}</p> : <ul>{children}</ul>}
      {count > 6 && <p className="border-t border-line px-4 py-2 text-[12px] text-muted sm:px-5">et {count - 6} autre(s)…</p>}
    </section>
  );
}

function StepRow({ step, onSelect, showPhase }: { step: Step; onSelect: () => void; showPhase?: boolean }) {
  const done = step.status === "Fait";
  const open = isOpenStep(step.status);
  const due = dueInfo(step.due, open);
  const tasksDone = step.tasks.filter((t) => t.done).length;

  return (
    <li className="group flex items-center gap-3 border-t border-line px-4 py-2.5 transition-colors hover:bg-surface-2/70 sm:px-5">
      {/* indicateur seulement : le statut se change dans le panneau de l'étape, via « Modifier » */}
      <span
        role="img"
        aria-label={done ? "Faite" : step.status}
        title={step.status}
        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${done ? "border-ok bg-ok text-surface" : "border-line text-transparent"}`}
      >
        <IconCheck size={13} strokeWidth={3} />
      </span>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-semibold ${done ? "text-faint line-through" : ""}`}>{step.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">
            {showPhase && <span className="truncate">{shortPhase(step.phase)}</span>}
            {!showPhase && step.org && <span className="truncate">{step.org}</span>}
            {step.tasks.length > 0 && (
              <span className="mono" title="Mini-étapes faites">
                {tasksDone}/{step.tasks.length} mini-étapes
              </span>
            )}
            {step.links.length > 0 && (
              <span className="inline-flex items-center gap-1" title="Liens officiels">
                <IconLink size={12} />
                {step.links.length}
              </span>
            )}
          </span>
        </span>

        {step.status !== "À faire" && step.status !== "Fait" && (
          <Chip tone={STEP_TONE[step.status]} dot className="hidden sm:inline-flex">
            {step.status}
          </Chip>
        )}
        {due && <Chip tone={due.tone} className="mono">{due.text}</Chip>}
        {!showPhase && (
          <span className="mono hidden w-24 shrink-0 text-right text-[12.5px] text-muted md:block">
            {step.actual != null ? `${fcfa(step.actual)} F` : step.planned != null ? <span className="text-faint">{fcfa(step.planned)} F</span> : ""}
          </span>
        )}
      </button>
    </li>
  );
}
