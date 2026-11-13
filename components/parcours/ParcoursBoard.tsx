"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { daysUntil, isLate, isOpenStep, phaseProgress } from "@/lib/rules";
import type { Step } from "@/lib/types";
import { StepDrawer } from "./StepDrawer";

type FilterKey = "upcoming" | "late" | "done" | "all";

const FILTERS: Array<[FilterKey, string]> = [
  ["upcoming", "À venir"],
  ["late", "En retard"],
  ["done", "Faites"],
  ["all", "Toutes"],
];

export function ParcoursBoard({ initialSteps }: { initialSteps: Step[] }) {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPhase, setNewPhase] = useState(initialSteps[0]?.phase ?? "1. Mise en ordre");
  const [newTitle, setNewTitle] = useState("");

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
      if (filter === "upcoming" && (s.status === "Fait" || s.status === "Si nécessaire")) return false;
      if (q && !`${s.title} ${s.org} ${s.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [steps, filter, query]);

  const counts = {
    upcoming: steps.filter(isOpenStep2).length,
    late: steps.filter((s) => isLate(s)).length,
    done: steps.filter((s) => s.status === "Fait").length,
    all: steps.length,
  };

  function isOpenStep2(s: Step) {
    return isOpenStep(s.status);
  }

  const selected = steps.find((s) => s.id === selectedId) ?? null;
  const selectedPosition = selected ? dueSorted.findIndex((s) => s.id === selected.id) + 1 : 0;

  function updateStep(updated: Step) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function navigate(direction: "prev" | "next") {
    if (!selected) return;
    const idx = dueSorted.findIndex((s) => s.id === selected.id);
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
    const target = dueSorted[nextIdx];
    if (target) setSelectedId(target.id);
  }

  async function addStep() {
    const title = newTitle.trim();
    if (!title) return;
    const id = `s-${Date.now().toString(36)}`;
    const position = steps.length;
    const row = { id, dossier_id: selected?.dossierId ?? steps[0]?.dossierId, phase: newPhase, title, status: "À faire" as const, org: "", req: "", notes: "", risk: "", position };
    const { error } = await supabase.from("step").insert(row);
    if (!error) {
      setSteps((prev) => [
        ...prev,
        { id, dossierId: row.dossier_id as string, phase: newPhase, title, due: null, status: "À faire", planned: null, actual: null, org: "", req: "", notes: "", risk: "", position, tasks: [], links: [] },
      ]);
      setNewTitle("");
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-1">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${filter === key ? "bg-act-soft text-act" : "text-muted"}`}
            >
              {label} <span className="font-mono text-xs opacity-80">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
          />
          <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-lg bg-act px-3 py-1.5 text-sm font-semibold text-act-ink">
            + Étape
          </button>
        </div>
      </div>

      {adding && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3">
          <label className="text-sm">
            Phase
            <input value={newPhase} onChange={(e) => setNewPhase(e.target.value)} className="mt-1 block rounded-md border border-line px-2 py-1 text-sm" />
          </label>
          <label className="flex-1 text-sm">
            Titre
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm" />
          </label>
          <button type="button" onClick={addStep} className="rounded-md bg-act px-3 py-1.5 text-sm font-semibold text-act-ink">
            Ajouter
          </button>
        </div>
      )}

      {phases.map(({ phase, pct }) => {
        const rows = filtered.filter((s) => s.phase === phase);
        if (!rows.length) return null;
        return (
          <div key={phase} className="mb-3.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2">
              <h3 className="text-base font-bold">{phase}</h3>
              <span className="font-mono text-xs text-muted">{pct}%</span>
            </div>
            <div className="mx-4 mb-1 h-[3px] overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full bg-ok" style={{ width: `${pct}%` }} />
            </div>
            {rows.map((s) => (
              <StepRow key={s.id} step={s} onSelect={() => setSelectedId(s.id)} />
            ))}
          </div>
        );
      })}

      {selected && (
        <StepDrawer
          step={selected}
          position={selectedPosition}
          total={steps.length}
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

function StepRow({ step, onSelect }: { step: Step; onSelect: () => void }) {
  const late = isLate(step);
  const inNext30 = (() => {
    const d = daysUntil(step.due);
    return d !== null && d >= 0 && d <= 30;
  })();

  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line px-4 py-2.5 text-left hover:bg-surface-2"
    >
      <input type="checkbox" readOnly checked={step.status === "Fait"} className="pointer-events-none" />
      <span className={`truncate text-sm font-semibold ${step.status === "Fait" ? "text-faint line-through" : ""}`}>{step.title}</span>
      <span className="flex items-center gap-1.5">
        {inNext30 && !late && <span className="rounded-md bg-signal-soft px-1.5 py-0.5 font-mono text-[11px] text-opt">30 j</span>}
        {step.due && (
          <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[12.5px] ${late ? "bg-bad-bg text-bad" : "bg-surface-2 text-muted"}`}>
            {step.due}
          </span>
        )}
      </span>
      <span className="font-mono text-xs text-muted">{step.actual != null ? `${step.actual.toLocaleString("fr-FR")} F` : ""}</span>
    </button>
  );
}
