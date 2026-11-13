"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { autoFillActual, daysUntil, nextStatusAfterTaskToggle, safeUrl } from "@/lib/rules";
import type { Step, StepStatus } from "@/lib/types";

const STATUSES: StepStatus[] = ["À faire", "En cours", "Bloqué", "Fait", "Si nécessaire"];

interface Props {
  step: Step;
  position: number;
  total: number;
  onChange: (step: Step) => void;
  onDelete: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onClose: () => void;
}

export function StepDrawer({ step, position, total, onChange, onDelete, onNavigate, onClose }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const supabase = createClient();
  const late = step.status !== "Fait" && step.status !== "Si nécessaire" && (daysUntil(step.due) ?? 0) < 0;

  async function patchStep(patch: Partial<Step>) {
    const dbPatch: Record<string, unknown> = {};
    if ("title" in patch) dbPatch.title = patch.title;
    if ("due" in patch) dbPatch.due = patch.due;
    if ("status" in patch) dbPatch.status = patch.status;
    if ("planned" in patch) dbPatch.planned = patch.planned;
    if ("actual" in patch) dbPatch.actual = patch.actual;
    if ("org" in patch) dbPatch.org = patch.org;
    if ("req" in patch) dbPatch.req = patch.req;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    if ("risk" in patch) dbPatch.risk = patch.risk;
    if ("phase" in patch) dbPatch.phase = patch.phase;

    onChange({ ...step, ...patch });
    await supabase.from("step").update(dbPatch).eq("id", step.id);
  }

  async function setStatus(status: StepStatus) {
    const actual = autoFillActual(step, status);
    await patchStep({ status, actual });
  }

  async function toggleTask(taskId: string, done: boolean) {
    const tasks = step.tasks.map((t) => (t.id === taskId ? { ...t, done } : t));
    const doneCount = tasks.filter((t) => t.done).length;
    const nextStatus = nextStatusAfterTaskToggle(step.status, doneCount, tasks.length);
    const actual = autoFillActual(step, nextStatus);

    onChange({ ...step, tasks, status: nextStatus, actual });
    await Promise.all([
      supabase.from("step_task").update({ done }).eq("id", taskId),
      nextStatus !== step.status || actual !== step.actual
        ? supabase.from("step").update({ status: nextStatus, actual }).eq("id", step.id)
        : Promise.resolve(),
    ]);
  }

  async function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setNewTask("");
    const { data } = await supabase
      .from("step_task")
      .insert({ step_id: step.id, text, done: false, position: step.tasks.length })
      .select("id")
      .single();
    if (data) onChange({ ...step, tasks: [...step.tasks, { id: data.id as string, text, done: false, position: step.tasks.length }] });
  }

  async function deleteTask(taskId: string) {
    const tasks = step.tasks.filter((t) => t.id !== taskId);
    const doneCount = tasks.filter((t) => t.done).length;
    const nextStatus = nextStatusAfterTaskToggle(step.status, doneCount, tasks.length);
    onChange({ ...step, tasks, status: nextStatus });
    await Promise.all([
      supabase.from("step_task").delete().eq("id", taskId),
      nextStatus !== step.status ? supabase.from("step").update({ status: nextStatus }).eq("id", step.id) : Promise.resolve(),
    ]);
  }

  async function addLink() {
    const url = safeUrl(newLinkUrl);
    if (!url) {
      setLinkError("Adresse invalide : elle doit commencer par https://");
      return;
    }
    const label = newLinkLabel.trim() || url;
    setLinkError(null);
    setNewLinkLabel("");
    setNewLinkUrl("");
    const { data } = await supabase.from("step_link").insert({ step_id: step.id, label, url }).select("id").single();
    if (data) onChange({ ...step, links: [...step.links, { id: data.id as string, label, url }] });
  }

  async function deleteLink(linkId: string) {
    onChange({ ...step, links: step.links.filter((l) => l.id !== linkId) });
    await supabase.from("step_link").delete().eq("id", linkId);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await supabase.from("step").delete().eq("id", step.id);
    onDelete();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-xs text-faint">
            ÉTAPE {position}/{total}
          </p>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Fermer">
            ✕
          </button>
        </div>

        <input
          value={step.title}
          onChange={(e) => patchStep({ title: e.target.value })}
          className="mt-2 w-full rounded-md border border-transparent bg-transparent font-display text-xl font-bold focus:border-line focus:bg-surface-2 focus:outline-none"
        />

        <div className="mt-2 flex items-center gap-2">
          {step.due && (
            <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[12.5px] ${late ? "bg-bad-bg text-bad" : "bg-surface-2 text-muted"}`}>
              {step.due}
            </span>
          )}
          {late && <span className="text-xs font-semibold text-bad">En retard</span>}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={step.status === s}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                step.status === s ? "border-act bg-act-soft text-act" : "border-line text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {step.risk && (
          <p className="mt-3 rounded-lg bg-opt-bg p-3 text-sm text-opt">⚠ {step.risk}</p>
        )}

        <Section title="Mini-étapes">
          <ul className="flex flex-col gap-1.5">
            {step.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <input type="checkbox" checked={t.done} onChange={(e) => toggleTask(t.id, e.target.checked)} />
                <span className={`flex-1 text-sm ${t.done ? "text-faint line-through" : ""}`}>{t.text}</span>
                <button type="button" onClick={() => deleteTask(t.id)} className="text-xs text-faint hover:text-bad">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Ajouter une mini-étape"
              className="flex-1 rounded-md border border-line px-2 py-1 text-sm"
            />
            <button type="button" onClick={addTask} className="rounded-md bg-act-soft px-3 py-1 text-sm font-semibold text-act">
              Ajouter
            </button>
          </div>
        </Section>

        <Section title="Liens officiels">
          <ul className="flex flex-col gap-1.5">
            {step.links.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-act underline">
                  {l.label}
                </a>
                <button type="button" onClick={() => deleteLink(l.id)} className="text-xs text-faint hover:text-bad">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2">
            <input
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
              placeholder="Libellé du lien"
              className="rounded-md border border-line px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 rounded-md border border-line px-2 py-1 text-sm"
              />
              <button type="button" onClick={addLink} className="rounded-md bg-act-soft px-3 py-1 text-sm font-semibold text-act">
                Ajouter
              </button>
            </div>
            {linkError && <p className="text-xs text-bad">{linkError}</p>}
          </div>
        </Section>

        <Section title="Échéance, phase et organisme">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Échéance">
              <input type="date" value={step.due ?? ""} onChange={(e) => patchStep({ due: e.target.value || null })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
            </Field>
            <Field label="Phase">
              <input value={step.phase} onChange={(e) => patchStep({ phase: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
            </Field>
          </div>
          <Field label="Organisme">
            <input value={step.org} onChange={(e) => patchStep({ org: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
        </Section>

        <Section title="Coût">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prévu (FCFA)">
              <input
                type="number"
                value={step.planned ?? ""}
                onChange={(e) => patchStep({ planned: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-full rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
              />
            </Field>
            <Field label="Payé (FCFA)">
              <input
                type="number"
                value={step.actual ?? ""}
                onChange={(e) => patchStep({ actual: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-full rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
              />
            </Field>
          </div>
        </Section>

        <Section title="Pièces, prérequis et notes">
          <Field label="Prérequis">
            <textarea value={step.req} onChange={(e) => patchStep({ req: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
          <Field label="Point de vigilance">
            <textarea value={step.risk} onChange={(e) => patchStep({ risk: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
          <Field label="Notes">
            <textarea value={step.notes} onChange={(e) => patchStep({ notes: e.target.value })} className="w-full rounded-md border border-line px-2 py-1 text-sm" />
          </Field>
        </Section>

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => onNavigate("prev")} className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-muted">
              ← Précédente
            </button>
            <button type="button" onClick={() => onNavigate("next")} className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-muted">
              Suivante →
            </button>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-bad-bg text-bad"}`}
          >
            {confirmDelete ? "Confirmer la suppression" : "Supprimer l'étape"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
