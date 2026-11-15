"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { autoFillActual, isOpenStep, nextStatusAfterTaskToggle } from "@/lib/rules";
import type { Contact, Step } from "@/lib/types";
import { personLabel, type ContactPerson, type ContactStepLink } from "@/lib/network";
import { Drawer, Meter, STEP_TONE, TONE_DOT, dueInfo, fcfa, fmtShortDate } from "@/components/ui";
import { Checklist } from "@/components/EditableLists";
import { DrawerCard, DrawerFacts, ReadRow } from "@/components/DrawerParts";
import { IconArrowRight, IconChevronLeft, IconMail, IconPhone } from "@/components/icons";
import { initials } from "./contactLink";
import { PhotoBadge } from "./PhotoPicker";

interface Props {
  step: Step;
  contacts: Contact[];
  persons: ContactPerson[];
  links: ContactStepLink[];
  /** Libellé du bouton retour (ex. l'organisme d'où l'on vient). */
  backLabel?: string;
  onBack?: () => void;
  onOpenPerson: (personId: string) => void;
  onOpenOrg: (contactId: string) => void;
  onChange: (step: Step) => void;
  onClose: () => void;
}

/** Détail d'une étape vue depuis les contacts : mini-étapes cochables, infos et personnes liées. */
export function StepPeek({ step, contacts, persons, links, backLabel, onBack, onOpenPerson, onOpenOrg, onChange, onClose }: Props) {
  const due = dueInfo(step.due, isOpenStep(step.status));
  const done = step.tasks.filter((t) => t.done).length;
  const orgOf = new Map(contacts.map((c) => [c.id, c]));
  const personOf = new Map(persons.map((p) => [p.id, p]));
  const [error, setError] = useState<string | null>(null);
  const shown = links.filter((l) => (l.contactId && orgOf.has(l.contactId)) || (l.personId && personOf.has(l.personId)));

  async function toggle(taskId: string, value: boolean) {
    const supabase = createClient();
    const tasks = step.tasks.map((t) => (t.id === taskId ? { ...t, done: value } : t));
    const status = nextStatusAfterTaskToggle(step.status, tasks.filter((t) => t.done).length, tasks.length);
    const actual = autoFillActual(step, status);
    setError(null);
    onChange({ ...step, tasks, status, actual });
    const [r1, r2] = await Promise.all([
      supabase.from("step_task").update({ done: value }).eq("id", taskId),
      status !== step.status || actual !== step.actual ? supabase.from("step").update({ status, actual }).eq("id", step.id) : Promise.resolve({ error: null }),
    ]);
    if (r1.error || r2.error) {
      // Retour à l'état d'avant : l'écran ne doit pas montrer une case cochée qui n'est pas enregistrée.
      onChange(step);
      if (!r1.error) await supabase.from("step_task").update({ done: !value }).eq("id", taskId);
      else if (!r2.error && (status !== step.status || actual !== step.actual)) await supabase.from("step").update({ status: step.status, actual: step.actual }).eq("id", step.id);
      setError("Enregistrement impossible : vérifiez la connexion et réessayez.");
    }
  }

  return (
    <Drawer
      label={`Tâche : ${step.title}`}
      onClose={onClose}
      topActions={
        onBack && (
          <button type="button" onClick={onBack} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-night-muted hover:bg-white/10 hover:text-night-ink" title="Retour">
            <IconChevronLeft size={16} /> <span className="max-w-[9rem] truncate">{backLabel ?? "Retour"}</span>
          </button>
        )
      }
      header={
        <>
          <p className="pr-28 text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Tâche du parcours · {step.phase.replace(/^\d+\.\s*/, "")}</p>
          <h2 className="mt-1.5 font-display text-[22px] leading-snug font-bold break-words">{step.title}</h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold">
              <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[STEP_TONE[step.status]]}`} />
              {step.status}
            </span>
            {due && (
              <span className={`mono rounded-full px-2.5 py-1 text-[12px] font-semibold ${due.tone === "bad" ? "bg-[#f29a90] text-[#2a0b08]" : due.tone === "opt" ? "bg-signal text-[#1b1206]" : "bg-white/10"}`}>{due.text}</span>
            )}
          </div>
          <DrawerFacts
            items={[
              { label: "Échéance", value: step.due ? fmtShortDate(step.due) : "—" },
              { label: "Mini-étapes", value: step.tasks.length ? `${done}/${step.tasks.length}` : "—" },
              { label: "Coût prévu", value: step.planned != null ? `${fcfa(step.planned)} F` : "—" },
            ]}
          />
        </>
      }
      footer={
        <div className="flex justify-end">
          <Link href={`/parcours?etape=${encodeURIComponent(step.id)}`} className="btn btn-sm btn-primary">
            Ouvrir dans le parcours <IconArrowRight size={14} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <DrawerCard title="Qui peut aider" sub="Contacts liés à cette tâche.">
          {shown.length === 0 && <p className="text-[13px] text-faint">Aucun contact lié à cette tâche.</p>}
          <ul className="flex flex-col gap-2">
            {shown.map((l) => {
              const c = l.contactId ? orgOf.get(l.contactId) : undefined;
              const p = l.personId ? personOf.get(l.personId) : undefined;
              if (!c && !p) return null;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => (p ? onOpenPerson(p.id) : c && onOpenOrg(c.id))}
                    className="flex w-full items-start gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2 text-left hover:bg-surface-2"
                  >
                    {p ? (
                      <PhotoBadge url={p.photoUrl} label={initials(p.name)} shape="circle" size={30} className="mt-0.5" />
                    ) : (
                      <PhotoBadge url={c?.photoUrl} label={(c?.org.trim()[0] ?? "?").toUpperCase()} shape="square" size={30} className="mt-0.5" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{p ? personLabel(p) : c?.org || "Organisme sans nom"}</span>
                      <span className="block truncate text-[12px] text-muted">{p ? (c ? c.org : p.relation || "Personne indépendante") : c?.role || "Organisme"}</span>
                      {p && (p.email || p.phone) && (
                        <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-act">
                          {p.email && (
                            <span className="inline-flex items-center gap-1">
                              <IconMail size={12} /> {p.email}
                            </span>
                          )}
                          {p.phone && (
                            <span className="inline-flex items-center gap-1">
                              <IconPhone size={12} /> {p.phone}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DrawerCard>

        <DrawerCard title="Mini-étapes" sub="Cochez au fur et à mesure : le statut de la tâche suit." aside={step.tasks.length ? <span className="mono text-[12px] text-muted">{Math.round((done / step.tasks.length) * 100)} %</span> : undefined}>
          {step.tasks.length > 0 && <Meter value={(done / step.tasks.length) * 100} tone="ok" height={4} className="mb-2" label="Mini-étapes faites" />}
          {step.tasks.length ? (
            <Checklist items={step.tasks} editable={false} onToggle={(id, v) => void toggle(id, v)} onDelete={() => undefined} onAdd={() => undefined} placeholder="" />
          ) : (
            <p className="text-[13px] text-faint">Aucune mini-étape.</p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[12.5px] font-semibold text-bad">
              {error}
            </p>
          )}
        </DrawerCard>

        <DrawerCard title="Infos">
          <dl className="m-0">
            <ReadRow label="Organisme" value={step.org} />
            <ReadRow label="Prérequis" value={step.req} />
            <ReadRow label="Vigilance" value={step.risk} />
            <ReadRow label="Notes" value={step.notes} />
          </dl>
        </DrawerCard>
      </div>
    </Drawer>
  );
}
