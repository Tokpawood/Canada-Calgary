"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { autoFillActual, isLate, isOpenStep, phaseProgress } from "@/lib/rules";
import type { Step, StepStatus } from "@/lib/types";
import { newId } from "@/lib/ids";
import { Chip, EmptyState, Segmented, STEP_TONE, dueInfo, fcfa } from "@/components/ui";
import { IconCheck, IconChevronDown, IconLink, IconPlus, IconRoute, IconSearch } from "@/components/icons";
import { StepDrawer } from "./StepDrawer";

type FilterKey = "upcoming" | "late" | "done" | "all";

export function ParcoursBoard({ initialSteps }: { initialSteps: Step[] }) {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newPhase, setNewPhase] = useState(initialSteps[0]?.phase ?? "1. Mise en ordre");
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const supabase = createClient();

  const dueSorted = useMemo(
    () =>
      [...steps].sort((a, b) => {
        const da = a.due ? new Date(a.due).getTime() : Infinity;
        const db = b.due ? new Date(b.due).getTime() : Infinity;
        return da - db;
      }),
    [steps],
  );

  const phases = useMemo(() => phaseProgress(steps), [steps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return steps.filter((s) => {
      if (filter === "late" && !isLate(s)) return false;
      if (filter === "done" && s.status !== "Fait") return false;
      if (filter === "upcoming" && !isOpenStep(s.status)) return false;
      if (q && !`${s.title} ${s.org} ${s.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [steps, filter, query]);

  const counts: Record<FilterKey, number> = {
    upcoming: steps.filter((s) => isOpenStep(s.status)).length,
    late: steps.filter((s) => isLate(s)).length,
    done: steps.filter((s) => s.status === "Fait").length,
    all: steps.length,
  };

  const selected = steps.find((s) => s.id === selectedId) ?? null;
  const selectedPosition = selected ? dueSorted.findIndex((s) => s.id === selected.id) + 1 : 0;

  function updateStep(updated: Step) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function toggleDone(s: Step) {
    const status: StepStatus = s.status === "Fait" ? (s.tasks.some((t) => t.done) ? "En cours" : "À faire") : "Fait";
    const actual = autoFillActual(s, status);
    updateStep({ ...s, status, actual });
    await supabase.from("step").update({ status, actual }).eq("id", s.id);
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

  const visiblePhases = phases.filter(({ phase }) => filtered.some((s) => s.phase === phase));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">Étapes</h2>
          <Segmented<FilterKey>
            label="Filtrer les étapes"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "upcoming", label: "À venir", count: counts.upcoming },
              { value: "late", label: "En retard", count: counts.late },
              { value: "done", label: "Faites", count: counts.done },
              { value: "all", label: "Toutes", count: counts.all },
            ]}
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une étape…" aria-label="Rechercher une étape" className="input pl-9" />
          </div>
          <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-primary" aria-expanded={adding}>
            <IconPlus size={16} />
            <span className="hidden sm:inline">Étape</span>
          </button>
        </div>
      </div>

      {adding && (
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
      )}

      {visiblePhases.length === 0 && (
        <EmptyState icon={<IconRoute size={20} />} title={filter === "late" ? "Aucune étape en retard" : "Aucune étape à afficher"}>
          {query ? "Aucun résultat pour cette recherche." : filter === "late" ? "Toutes les échéances sont tenues." : "Changez de filtre pour voir d'autres étapes."}
        </EmptyState>
      )}

      <div className="flex flex-col gap-4">
        {visiblePhases.map(({ phase, pct }, i) => {
          const rows = dueSorted.filter((s) => s.phase === phase && filtered.includes(s));
          const all = steps.filter((s) => s.phase === phase);
          const doneCount = all.filter((s) => s.status === "Fait").length;
          const isCollapsed = collapsed[phase] ?? false;
          const phaseIndex = phases.findIndex((p) => p.phase === phase) + 1;
          return (
            <section key={phase} className="card overflow-hidden" style={{ animationDelay: `${i * 30}ms` }}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [phase]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60 sm:px-5"
              >
                <span className={`mono grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${pct === 100 ? "bg-ok text-surface" : "bg-act-soft text-act"}`}>
                  {pct === 100 ? <IconCheck size={15} /> : phaseIndex}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate text-[16px] font-bold">{phase.replace(/^\d+\.\s*/, "")}</h3>
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
                    <StepRow key={s.id} step={s} onSelect={() => setSelectedId(s.id)} onToggle={() => toggleDone(s)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <StepDrawer
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

function StepRow({ step, onSelect, onToggle }: { step: Step; onSelect: () => void; onToggle: () => void }) {
  const done = step.status === "Fait";
  const open = isOpenStep(step.status);
  const due = dueInfo(step.due, open);
  const tasksDone = step.tasks.filter((t) => t.done).length;

  return (
    <li className="group flex items-center gap-3 border-t border-line px-4 py-2.5 transition-colors hover:bg-surface-2/70 sm:px-5">
      <button
        type="button"
        onClick={onToggle}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Marquer « ${step.title} » comme à faire` : `Marquer « ${step.title} » comme faite`}
        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors ${
          done ? "border-ok bg-ok text-surface" : "border-line text-transparent hover:border-ok hover:text-ok"
        }`}
      >
        <IconCheck size={13} strokeWidth={3} />
      </button>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-semibold ${done ? "text-faint line-through" : ""}`}>{step.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">
            {step.org && <span className="truncate">{step.org}</span>}
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
        <span className="mono hidden w-24 shrink-0 text-right text-[12.5px] text-muted md:block">
          {step.actual != null ? `${fcfa(step.actual)} F` : step.planned != null ? <span className="text-faint">{fcfa(step.planned)} F</span> : ""}
        </span>
      </button>
    </li>
  );
}
