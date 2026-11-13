"use client";

import { createClient } from "@/lib/supabase/client";
import { autoFillActual, isOpenStep, nextStatusAfterTaskToggle } from "@/lib/rules";
import type { Step, StepStatus } from "@/lib/types";
import { Chip, ConfirmButton, Drawer, DrawerSection, Field, Meter, STEP_TONE, TONE_DOT, dueInfo, fcfa } from "@/components/ui";
import { Checklist, LinkList } from "@/components/EditableLists";
import { IconAlert, IconChevronLeft, IconChevronRight, IconTrash } from "@/components/icons";

const STATUSES: StepStatus[] = ["À faire", "En cours", "Bloqué", "Fait", "Si nécessaire"];

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

const DB_FIELDS: Array<keyof Step> = ["title", "due", "status", "planned", "actual", "org", "req", "notes", "risk", "phase"];

export function StepDrawer({ step, position, total, phases, onChange, onDelete, onNavigate, onClose }: Props) {
  const supabase = createClient();
  const due = dueInfo(step.due, isOpenStep(step.status));
  const tasksDone = step.tasks.filter((t) => t.done).length;

  async function patchStep(patch: Partial<Step>) {
    const dbPatch: Record<string, unknown> = {};
    for (const k of DB_FIELDS) if (k in patch) dbPatch[k] = patch[k];
    onChange({ ...step, ...patch });
    await supabase.from("step").update(dbPatch).eq("id", step.id);
  }

  async function setStatus(status: StepStatus) {
    await patchStep({ status, actual: autoFillActual(step, status) });
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

  async function addTask(text: string) {
    const { data } = await supabase.from("step_task").insert({ step_id: step.id, text, done: false, position: step.tasks.length }).select("id").single();
    if (data) onChange({ ...step, tasks: [...step.tasks, { id: data.id as string, text, done: false, position: step.tasks.length }] });
  }

  async function deleteTask(taskId: string) {
    const tasks = step.tasks.filter((t) => t.id !== taskId);
    const nextStatus = nextStatusAfterTaskToggle(step.status, tasks.filter((t) => t.done).length, tasks.length);
    onChange({ ...step, tasks, status: nextStatus });
    await Promise.all([
      supabase.from("step_task").delete().eq("id", taskId),
      nextStatus !== step.status ? supabase.from("step").update({ status: nextStatus }).eq("id", step.id) : Promise.resolve(),
    ]);
  }

  async function addLink(label: string, url: string) {
    const { data } = await supabase.from("step_link").insert({ step_id: step.id, label, url }).select("id").single();
    if (data) onChange({ ...step, links: [...step.links, { id: data.id as string, label, url }] });
  }

  async function deleteLink(linkId: string) {
    onChange({ ...step, links: step.links.filter((l) => l.id !== linkId) });
    await supabase.from("step_link").delete().eq("id", linkId);
  }

  async function handleDelete() {
    await supabase.from("step").delete().eq("id", step.id);
    onDelete();
  }

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Drawer
      label={`Étape : ${step.title}`}
      onClose={onClose}
      footer={
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
          <ConfirmButton label="Supprimer l'étape" confirmLabel="Confirmer la suppression" onConfirm={handleDelete}>
            <IconTrash size={14} />
            Supprimer
          </ConfirmButton>
        </div>
      }
    >
      <p className="eyebrow pr-10">
        Étape {position} / {total} · {step.phase}
      </p>
      <textarea
        value={step.title}
        rows={2}
        onChange={(e) => patchStep({ title: e.target.value })}
        aria-label="Intitulé de l'étape"
        className="input-ghost -mx-1.5 mt-1.5 resize-none font-display text-[21px] leading-snug font-bold"
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
              onClick={() => setStatus(s)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                active ? "border-act bg-act-soft text-act" : "border-line text-muted hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STEP_TONE[s]]}`} />
              {s}
            </button>
          );
        })}
      </div>

      {step.risk && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-opt/25 bg-opt-bg p-3 text-[13.5px] text-opt">
          <IconAlert size={17} className="mt-px shrink-0" />
          <p>{step.risk}</p>
        </div>
      )}

      <DrawerSection
        title="Mini-étapes"
        aside={step.tasks.length > 0 ? <span className="mono text-[12px] text-muted">{tasksDone}/{step.tasks.length}</span> : undefined}
      >
        {step.tasks.length > 0 && <Meter value={(tasksDone / step.tasks.length) * 100} tone="ok" height={4} className="mb-2" label="Mini-étapes faites" />}
        <Checklist items={step.tasks} onToggle={toggleTask} onDelete={deleteTask} onAdd={addTask} placeholder="Ajouter une mini-étape" />
      </DrawerSection>

      <DrawerSection title="Liens officiels">
        <LinkList links={step.links} onAdd={addLink} onDelete={deleteLink} />
      </DrawerSection>

      <DrawerSection title="Planification">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Échéance">
            <input type="date" value={step.due ?? ""} onChange={(e) => patchStep({ due: e.target.value || null })} className="input" />
          </Field>
          <Field label="Phase">
            <select value={step.phase} onChange={(e) => patchStep({ phase: e.target.value })} className="input">
              {(phases.includes(step.phase) ? phases : [step.phase, ...phases]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Organisme" className="col-span-2">
            <input value={step.org} onChange={(e) => patchStep({ org: e.target.value })} className="input" />
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection
        title="Coût"
        aside={step.planned != null && step.actual != null && step.actual !== step.planned ? (
          <span className={`mono text-[12px] ${step.actual > step.planned ? "text-bad" : "text-ok"}`}>
            {step.actual > step.planned ? "+" : "−"}
            {fcfa(Math.abs(step.actual - step.planned))} F
          </span>
        ) : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prévu (FCFA)">
            <input type="number" inputMode="numeric" value={step.planned ?? ""} onChange={(e) => patchStep({ planned: num(e.target.value) })} className="input mono text-right" />
          </Field>
          <Field label="Payé (FCFA)">
            <input type="number" inputMode="numeric" value={step.actual ?? ""} onChange={(e) => patchStep({ actual: num(e.target.value) })} className="input mono text-right" />
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection title="Pièces, prérequis et notes">
        <div className="flex flex-col gap-3">
          <Field label="Prérequis">
            <textarea value={step.req} onChange={(e) => patchStep({ req: e.target.value })} className="input" />
          </Field>
          <Field label="Point de vigilance">
            <textarea value={step.risk} onChange={(e) => patchStep({ risk: e.target.value })} className="input" />
          </Field>
          <Field label="Notes">
            <textarea value={step.notes} onChange={(e) => patchStep({ notes: e.target.value })} className="input" />
          </Field>
        </div>
      </DrawerSection>
    </Drawer>
  );
}
