"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { autoFillActual, isOpenStep, nextStatusAfterTaskToggle } from "@/lib/rules";
import type { Step, StepStatus } from "@/lib/types";
import { Chip, ConfirmButton, Drawer, DrawerSection, Field, Meter, STEP_TONE, TONE_DOT, dueInfo, fcfa } from "@/components/ui";
import { Checklist, LinkList } from "@/components/EditableLists";
import { EditBar, changedFields, isTmp, tmpId, useEditable } from "@/components/editable";
import { IconAlert, IconChevronLeft, IconChevronRight, IconTrash } from "@/components/icons";

const STATUSES: StepStatus[] = ["À faire", "En cours", "Bloqué", "Fait", "Si nécessaire"];

const SCALARS = ["title", "due", "phase", "org", "planned", "actual", "req", "risk", "notes"] as const;
type StepDraft = Pick<Step, (typeof SCALARS)[number] | "tasks" | "links">;

interface Props {
  step: Step;
  position: number;
  total: number;
  phases: string[];
  onChange: (step: Step) => void;
  onDelete: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onClose: () => void;
}

export function StepDrawer({ step, position, total, phases, onChange, onDelete, onNavigate, onClose }: Props) {
  const supabase = createClient();
  const [warn, setWarn] = useState(false);

  const saved: StepDraft = useMemo(
    () => ({
      title: step.title,
      due: step.due,
      phase: step.phase,
      org: step.org,
      planned: step.planned,
      actual: step.actual,
      req: step.req,
      risk: step.risk,
      notes: step.notes,
      tasks: step.tasks,
      links: step.links,
    }),
    [step],
  );

  const ed = useEditable(saved, async (d) => {
    const removedTasks = step.tasks.filter((t) => !d.tasks.some((x) => x.id === t.id)).map((t) => t.id);
    if (removedTasks.length) {
      const { error } = await supabase.from("step_task").delete().in("id", removedTasks);
      if (error) throw error;
    }
    const tasks: Step["tasks"] = [];
    for (const [i, t] of d.tasks.entries()) {
      if (!isTmp(t.id)) {
        tasks.push(t);
        continue;
      }
      const { data, error } = await supabase.from("step_task").insert({ step_id: step.id, text: t.text, done: false, position: i }).select("id").single();
      if (error) throw error;
      tasks.push({ ...t, id: data.id as string, position: i });
    }

    const removedLinks = step.links.filter((l) => !d.links.some((x) => x.id === l.id)).map((l) => l.id);
    if (removedLinks.length) {
      const { error } = await supabase.from("step_link").delete().in("id", removedLinks);
      if (error) throw error;
    }
    const links: Step["links"] = [];
    for (const l of d.links) {
      if (!isTmp(l.id)) {
        links.push(l);
        continue;
      }
      const { data, error } = await supabase.from("step_link").insert({ step_id: step.id, label: l.label, url: l.url }).select("id").single();
      if (error) throw error;
      links.push({ ...l, id: data.id as string });
    }

    const patch: Record<string, unknown> = changedFields(saved, d, [...SCALARS]);
    let status = step.status;
    if (tasks.length !== step.tasks.length) {
      status = nextStatusAfterTaskToggle(step.status, tasks.filter((t) => t.done).length, tasks.length);
      if (status !== step.status) patch.status = status;
    }
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("step").update(patch).eq("id", step.id);
      if (error) throw error;
    }
    onChange({ ...step, ...d, tasks, links, status });
    setWarn(false);
  });

  const v = ed.current;
  const off = !ed.editing;
  const due = dueInfo(step.due, isOpenStep(step.status));
  const tasksDone = v.tasks.filter((t) => t.done).length;

  function guardedClose() {
    if (ed.dirty) {
      setWarn(true);
      return;
    }
    onClose();
  }

  async function setStatus(status: StepStatus) {
    const actual = autoFillActual(step, status);
    onChange({ ...step, status, actual });
    await supabase.from("step").update({ status, actual }).eq("id", step.id);
  }

  async function toggleTask(taskId: string, done: boolean) {
    const tasks = step.tasks.map((t) => (t.id === taskId ? { ...t, done } : t));
    const nextStatus = nextStatusAfterTaskToggle(step.status, tasks.filter((t) => t.done).length, tasks.length);
    const actual = autoFillActual(step, nextStatus);
    onChange({ ...step, tasks, status: nextStatus, actual });
    await Promise.all([
      supabase.from("step_task").update({ done }).eq("id", taskId),
      nextStatus !== step.status || actual !== step.actual ? supabase.from("step").update({ status: nextStatus, actual }).eq("id", step.id) : Promise.resolve(),
    ]);
  }

  async function handleDelete() {
    await supabase.from("step").delete().eq("id", step.id);
    onDelete();
  }

  const num = (s: string) => (s === "" ? null : Number(s));

  return (
    <Drawer
      label={`Étape : ${step.title}`}
      onClose={guardedClose}
      footer={
        ed.editing ? (
          <div>
            {warn && <p className="mb-2 text-[12.5px] font-semibold text-bad">Modifications non enregistrées : enregistrez-les ou annulez avant de fermer.</p>}
            <EditBar edit={ed} />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button type="button" onClick={() => onNavigate("prev")} disabled={position <= 1} className="btn btn-sm btn-ghost" aria-label="Étape précédente">
                <IconChevronLeft size={15} />
                <span className="hidden sm:inline">Précédente</span>
              </button>
              <button type="button" onClick={() => onNavigate("next")} disabled={position >= total} className="btn btn-sm btn-ghost" aria-label="Étape suivante">
                <span className="hidden sm:inline">Suivante</span>
                <IconChevronRight size={15} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <EditBar edit={ed} />
              <ConfirmButton label="Supprimer l'étape" confirmLabel="Confirmer" onConfirm={handleDelete}>
                <IconTrash size={14} />
                <span className="hidden sm:inline">Supprimer</span>
              </ConfirmButton>
            </div>
          </div>
        )
      }
    >
      <p className="eyebrow pr-10">
        Étape {position} / {total} · {step.phase}
        {ed.editing && <span className="ml-2 rounded-md bg-act px-1.5 py-0.5 text-[10px] text-act-ink">Modification</span>}
      </p>
      <textarea
        value={v.title}
        rows={2}
        disabled={off}
        onChange={(e) => ed.set({ title: e.target.value })}
        aria-label="Intitulé de l'étape"
        className={`input-ghost -mx-1.5 mt-1.5 resize-none font-display text-[21px] leading-snug font-bold ${off ? "" : "border-line bg-surface"}`}
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {due && <Chip tone={due.tone} className="mono">{due.text}</Chip>}
        {step.org && <span className="text-[13px] text-muted">{step.org}</span>}
      </div>

      <div role="radiogroup" aria-label="Statut" className="mt-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = step.status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={ed.editing}
              onClick={() => setStatus(s)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-60 ${
                active ? "border-act bg-act-soft text-act" : "border-line text-muted enabled:hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STEP_TONE[s]]}`} />
              {s}
            </button>
          );
        })}
      </div>

      {step.risk && !ed.editing && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-opt/25 bg-opt-bg p-3 text-[13.5px] text-opt">
          <IconAlert size={17} className="mt-px shrink-0" />
          <p>{step.risk}</p>
        </div>
      )}

      <DrawerSection title="Mini-étapes" aside={v.tasks.length > 0 ? <span className="mono text-[12px] text-muted">{tasksDone}/{v.tasks.length}</span> : undefined}>
        {v.tasks.length > 0 && <Meter value={(tasksDone / v.tasks.length) * 100} tone="ok" height={4} className="mb-2" label="Mini-étapes faites" />}
        <Checklist
          items={v.tasks}
          editable={ed.editing}
          toggleDisabled={ed.editing}
          onToggle={toggleTask}
          onDelete={(id) => ed.update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))}
          onAdd={(text) => ed.update((d) => ({ ...d, tasks: [...d.tasks, { id: tmpId(), text, done: false, position: d.tasks.length }] }))}
          placeholder="Ajouter une mini-étape"
        />
      </DrawerSection>

      <DrawerSection title="Liens officiels">
        <LinkList
          links={v.links}
          editable={ed.editing}
          onAdd={(label, url) => ed.update((d) => ({ ...d, links: [...d.links, { id: tmpId(), label, url }] }))}
          onDelete={(id) => ed.update((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) }))}
        />
      </DrawerSection>

      <DrawerSection title="Planification">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Échéance">
            <input type="date" disabled={off} value={v.due ?? ""} onChange={(e) => ed.set({ due: e.target.value || null })} className="input" />
          </Field>
          <Field label="Phase">
            <select disabled={off} value={v.phase} onChange={(e) => ed.set({ phase: e.target.value })} className="input">
              {(phases.includes(v.phase) ? phases : [v.phase, ...phases]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Organisme" className="col-span-2">
            <input disabled={off} value={v.org} onChange={(e) => ed.set({ org: e.target.value })} className="input" />
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection
        title="Coût"
        aside={
          v.planned != null && v.actual != null && v.actual !== v.planned ? (
            <span className={`mono text-[12px] ${v.actual > v.planned ? "text-bad" : "text-ok"}`}>
              {v.actual > v.planned ? "+" : "−"}
              {fcfa(Math.abs(v.actual - v.planned))} F
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prévu (FCFA)">
            <input type="number" inputMode="numeric" disabled={off} value={v.planned ?? ""} onChange={(e) => ed.set({ planned: num(e.target.value) })} className="input mono text-right" />
          </Field>
          <Field label="Payé (FCFA)">
            <input type="number" inputMode="numeric" disabled={off} value={v.actual ?? ""} onChange={(e) => ed.set({ actual: num(e.target.value) })} className="input mono text-right" />
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection title="Pièces, prérequis et notes">
        <div className="flex flex-col gap-3">
          <Field label="Prérequis">
            <textarea disabled={off} value={v.req} onChange={(e) => ed.set({ req: e.target.value })} className="input" />
          </Field>
          <Field label="Point de vigilance">
            <textarea disabled={off} value={v.risk} onChange={(e) => ed.set({ risk: e.target.value })} className="input" />
          </Field>
          <Field label="Notes">
            <textarea disabled={off} value={v.notes} onChange={(e) => ed.set({ notes: e.target.value })} className="input" />
          </Field>
        </div>
      </DrawerSection>
    </Drawer>
  );
}
