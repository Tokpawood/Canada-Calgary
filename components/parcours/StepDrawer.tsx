"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { autoFillActual, isOpenStep, nextStatusAfterTaskToggle } from "@/lib/rules";
import type { Contact, Step, StepStatus } from "@/lib/types";
import type { ContactPerson, ContactStepLink } from "@/lib/network";
import { StepContacts } from "@/components/contacts/Links";
import { ConfirmButton, Drawer, Field, Meter, STEP_TONE, TONE_DOT, dueInfo, fcfa, fmtShortDate } from "@/components/ui";
import { Checklist, LinkList } from "@/components/EditableLists";
import { EditBar, changedFields, isTmp, tmpId, useEditable } from "@/components/editable";
import { IconAlert, IconChevronLeft, IconChevronRight, IconTrash } from "@/components/icons";
import { HeaderTabs } from "@/components/DarkHeader";
import { DarkStatusPicker, DrawerCard, DrawerFacts, DrawerTitle, ReadRow } from "@/components/DrawerParts";

type StepTab = "taches" | "infos" | "contacts" | "notes" | "liens";

const STATUSES: StepStatus[] = ["À faire", "En cours", "Bloqué", "Fait", "Si nécessaire"];

const SCALARS = ["title", "status", "due", "phase", "org", "planned", "actual", "req", "risk", "notes"] as const;
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
  contacts: {
    contacts: Contact[];
    persons: ContactPerson[];
    links: ContactStepLink[];
    onAdd: (l: ContactStepLink) => void;
    onRemove: (id: string) => void;
  };
}

export function StepDrawer({ step, position, total, phases, onChange, onDelete, onNavigate, onClose, contacts }: Props) {
  const supabase = createClient();
  const [warn, setWarn] = useState(false);
  const [tab, setTab] = useState<StepTab>("taches");

  const saved: StepDraft = useMemo(
    () => ({
      title: step.title,
      status: step.status,
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

    // Statut choisi, ajusté si des mini-étapes ont été ajoutées ou retirées ; « Fait » reporte le coût prévu s'il n'y a pas de montant payé.
    const status = tasks.length !== step.tasks.length ? nextStatusAfterTaskToggle(d.status, tasks.filter((t) => t.done).length, tasks.length) : d.status;
    const actual = status !== step.status ? autoFillActual({ planned: d.planned, actual: d.actual }, status) : d.actual;
    const final = { ...d, status, actual };
    const patch: Record<string, unknown> = changedFields(saved, final, [...SCALARS]);
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("step").update(patch).eq("id", step.id);
      if (error) throw error;
    }
    onChange({ ...step, ...final, tasks, links });
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

  const costGap = v.planned != null && v.actual != null && v.actual !== v.planned ? v.actual - v.planned : null;
  const notesCount = [v.req, v.risk, v.notes].filter((x) => x.trim()).length;

  return (
    <Drawer
      label={`Étape : ${step.title}`}
      onClose={guardedClose}
      topActions={
        !ed.editing && (
          <>
            <button type="button" onClick={() => onNavigate("prev")} disabled={position <= 1} className={NAV_BTN} aria-label="Étape précédente" title="Étape précédente">
              <IconChevronLeft size={17} />
            </button>
            <button type="button" onClick={() => onNavigate("next")} disabled={position >= total} className={NAV_BTN} aria-label="Étape suivante" title="Étape suivante">
              <IconChevronRight size={17} />
            </button>
          </>
        )
      }
      header={
        <>
          <p className="pr-28 text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">
            Étape {position} / {total} · {step.phase.replace(/^\d+\.\s*/, "")}
          </p>
          <DrawerTitle value={v.title} editing={ed.editing} onChange={(title) => ed.set({ title })} label="Intitulé de l'étape" />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <DarkStatusPicker options={STATUSES} value={v.status} editing={ed.editing} onChange={(status) => ed.set({ status })} dotClass={(s) => TONE_DOT[STEP_TONE[s]]} label="Statut" />
            {!ed.editing && due && (
              <span className={`mono rounded-full px-2.5 py-1 text-[12px] font-semibold ${due.tone === "bad" ? "bg-[#f29a90] text-[#2a0b08]" : due.tone === "opt" ? "bg-signal text-[#1b1206]" : "bg-white/10"}`}>
                {due.text}
              </span>
            )}
            {!ed.editing && step.org && <span className="text-[12.5px] text-night-muted">{step.org}</span>}
          </div>
          <DrawerFacts
            items={[
              { label: "Échéance", value: step.due ? fmtShortDate(step.due) : "—" },
              { label: "Coût payé / prévu", value: step.planned != null || step.actual != null ? `${fcfa(step.actual)} / ${fcfa(step.planned)} F` : "—", tone: costGap != null && costGap > 0 ? "bad" : undefined },
              {
                label: "Mini-étapes",
                value: v.tasks.length ? (
                  <span className="flex items-center gap-2">
                    {tasksDone}/{v.tasks.length}
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-signal" style={{ width: `${(tasksDone / v.tasks.length) * 100}%` }} />
                    </span>
                  </span>
                ) : (
                  "—"
                ),
              },
            ]}
          />
        </>
      }
      tabs={
        <HeaderTabs
          label="Sections de l'étape"
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "taches", label: "Mini-étapes", badge: v.tasks.length ? { text: `${tasksDone}/${v.tasks.length}` } : null },
            { id: "infos", label: "Infos" },
            { id: "contacts", label: "Contacts", badge: contacts.links.length ? { text: String(contacts.links.length) } : null },
            { id: "notes", label: "Notes", badge: step.risk ? { text: "!", tone: "signal" } : notesCount ? { text: String(notesCount) } : null },
            { id: "liens", label: "Liens", badge: v.links.length ? { text: String(v.links.length) } : null },
          ]}
        />
      }
      footer={
        <div>
          {warn && <p className="mb-2 text-[12.5px] font-semibold text-bad">Modifications non enregistrées : enregistrez-les ou annulez avant de fermer.</p>}
          <div className="flex items-center justify-between gap-2">
            {ed.editing ? (
              <span className="text-[12.5px] font-semibold text-opt">Modification en cours</span>
            ) : (
              <ConfirmButton label="Supprimer l'étape" confirmLabel="Confirmer" onConfirm={handleDelete}>
                <IconTrash size={14} />
                <span className="hidden sm:inline">Supprimer</span>
              </ConfirmButton>
            )}
            <EditBar edit={ed} />
          </div>
        </div>
      }
    >
      {step.risk && !ed.editing && tab !== "notes" && (
        <button
          type="button"
          onClick={() => setTab("notes")}
          className="mb-4 flex w-full gap-2.5 rounded-xl border border-opt/25 bg-opt-bg p-3 text-left text-[13px] text-opt hover:border-opt/50"
        >
          <IconAlert size={16} className="mt-px shrink-0" />
          <span className="line-clamp-2">
            <span className="font-semibold">Vigilance · </span>
            {step.risk}
          </span>
        </button>
      )}

      {tab === "taches" && (
        <DrawerCard
          title="Mini-étapes"
          sub={ed.editing ? "Ajoutez ou retirez des mini-étapes." : "Cochez au fur et à mesure : le statut de l'étape suit."}
          aside={v.tasks.length > 0 ? <span className="mono text-[12px] text-muted">{Math.round((tasksDone / v.tasks.length) * 100)} %</span> : undefined}
        >
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
        </DrawerCard>
      )}

      {tab === "infos" && (
        <div className="flex flex-col gap-4">
          <DrawerCard title="Planification">
            {off ? (
              <dl className="m-0">
                <ReadRow label="Échéance" value={step.due ? fmtShortDate(step.due) : ""} />
                <ReadRow label="Phase" value={step.phase} />
                <ReadRow label="Organisme" value={step.org} />
              </dl>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Échéance">
                  <input type="date" value={v.due ?? ""} onChange={(e) => ed.set({ due: e.target.value || null })} className="input" />
                </Field>
                <Field label="Phase">
                  <select value={v.phase} onChange={(e) => ed.set({ phase: e.target.value })} className="input">
                    {(phases.includes(v.phase) ? phases : [v.phase, ...phases]).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Organisme" className="col-span-2">
                  <input value={v.org} onChange={(e) => ed.set({ org: e.target.value })} className="input" />
                </Field>
              </div>
            )}
          </DrawerCard>

          <DrawerCard
            title="Coût"
            aside={
              costGap != null ? (
                <span className={`mono text-[12px] font-semibold ${costGap > 0 ? "text-bad" : "text-ok"}`}>
                  {costGap > 0 ? "+" : "−"}
                  {fcfa(Math.abs(costGap))} F
                </span>
              ) : undefined
            }
          >
            {off ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Prévu", v: step.planned },
                  { label: "Payé", v: step.actual },
                ].map((x) => (
                  <div key={x.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
                    <p className="text-[11.5px] text-muted">{x.label}</p>
                    <p className="mono text-[17px] font-semibold">{x.v != null ? `${fcfa(x.v)} F` : "—"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prévu (FCFA)">
                  <input type="number" inputMode="numeric" value={v.planned ?? ""} onChange={(e) => ed.set({ planned: num(e.target.value) })} className="input mono text-right" />
                </Field>
                <Field label="Payé (FCFA)">
                  <input type="number" inputMode="numeric" value={v.actual ?? ""} onChange={(e) => ed.set({ actual: num(e.target.value) })} className="input mono text-right" />
                </Field>
              </div>
            )}
            {off && <p className="mt-2 text-[11.5px] text-faint">Passer l&apos;étape à « Fait » reporte le coût prévu si aucun montant payé n&apos;est saisi.</p>}
          </DrawerCard>
        </div>
      )}

      {tab === "contacts" && (
        <DrawerCard title="Qui peut aider" sub="Organismes et personnes de vos contacts liés à cette étape.">
          <StepContacts
            stepId={step.id}
            contacts={contacts.contacts}
            persons={contacts.persons}
            links={contacts.links}
            canEdit={!ed.editing}
            onAdd={contacts.onAdd}
            onRemove={contacts.onRemove}
          />
        </DrawerCard>
      )}

      {tab === "notes" && (
        <div className="flex flex-col gap-4">
          {(
            [
              { key: "req", title: "Prérequis", sub: "Pièces et conditions nécessaires avant de commencer." },
              { key: "risk", title: "Point de vigilance", sub: "Ce qui peut bloquer ou retarder l'étape." },
              { key: "notes", title: "Notes", sub: "Vos remarques libres." },
            ] as const
          ).map((n) => (
            <DrawerCard key={n.key} title={n.title} sub={n.sub} className={n.key === "risk" && v.risk && off ? "border-opt/30" : ""}>
              {off ? (
                v[n.key] ? (
                  <p className={`text-[13.5px] leading-relaxed whitespace-pre-line ${n.key === "risk" ? "text-opt" : ""}`}>{v[n.key]}</p>
                ) : (
                  <p className="text-[13px] text-faint">Rien de noté.</p>
                )
              ) : (
                <textarea value={v[n.key]} onChange={(e) => ed.set({ [n.key]: e.target.value } as Partial<StepDraft>)} className="input" rows={3} aria-label={n.title} />
              )}
            </DrawerCard>
          ))}
        </div>
      )}

      {tab === "liens" && (
        <DrawerCard title="Liens officiels" sub="Uniquement des adresses en https://.">
          <LinkList
            links={v.links}
            editable={ed.editing}
            onAdd={(label, url) => ed.update((d) => ({ ...d, links: [...d.links, { id: tmpId(), label, url }] }))}
            onDelete={(id) => ed.update((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) }))}
          />
        </DrawerCard>
      )}
    </Drawer>
  );
}

const NAV_BTN = "grid h-8 w-8 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink disabled:opacity-30 disabled:hover:bg-transparent";
