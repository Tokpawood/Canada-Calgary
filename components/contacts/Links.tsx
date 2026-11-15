"use client";

import Link from "next/link";
import { useState } from "react";
import type { Contact } from "@/lib/types";
import { personLabel, type ContactPerson, type ContactStepLink, type StepLite } from "@/lib/network";
import { linkStep, parseTarget, targetValue, unlinkStep } from "@/lib/networkClient";
import { STEP_TONE, TONE_DOT, fmtShortDate } from "@/components/ui";
import { IconLink, IconMail, IconPhone, IconUser, IconX } from "@/components/icons";
import { contactLink } from "./contactLink";

const shortPhase = (p: string) => p.replace(/^\d+\.\s*/, "");

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

/** Sur la fiche d'un organisme : les étapes du parcours où il intervient (lui ou l'une de ses personnes). */
export function ContactSteps({
  contact,
  persons,
  links,
  steps,
  canEdit,
  onAdd,
  onRemove,
  onOpenStep,
}: {
  onOpenStep?: (stepId: string) => void;
  contact: Contact;
  persons: ContactPerson[];
  links: ContactStepLink[];
  steps: StepLite[];
  canEdit: boolean;
  onAdd: (l: ContactStepLink) => void;
  onRemove: (id: string) => void;
}) {
  const [stepId, setStepId] = useState("");
  const [who, setWho] = useState(contact.id);
  const act = useAction();
  const byStep = new Map(steps.map((s) => [s.id, s]));
  const personOf = new Map(persons.map((p) => [p.id, p]));
  const target = parseTarget(who);
  const taken = new Set(links.filter((l) => targetValue(l.contactId, l.personId) === who).map((l) => l.stepId));
  const sorted = [...links].sort((a, b) => steps.findIndex((s) => s.id === a.stepId) - steps.findIndex((s) => s.id === b.stepId));

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="text-[13px] text-faint">Aucune tâche liée.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sorted.map((l) => {
            const s = byStep.get(l.stepId);
            if (!s) return null;
            const p = l.personId ? personOf.get(l.personId) : null;
            return (
              <li key={l.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-2/60">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[STEP_TONE[s.status]]}`} title={s.status} />
                {onOpenStep ? (
                  <button type="button" onClick={() => onOpenStep(s.id)} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium hover:text-act hover:underline">
                    {s.title}
                  </button>
                ) : (
                  <Link href={`/parcours?etape=${encodeURIComponent(s.id)}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium hover:text-act hover:underline">
                    {s.title}
                  </Link>
                )}
                {p && <span className="hidden shrink-0 text-[12px] text-muted sm:inline">avec {p.name}</span>}
                {s.due && <span className="mono shrink-0 text-[11.5px] text-faint">{fmtShortDate(s.due)}</span>}
                {canEdit && (
                  <button
                    type="button"
                    disabled={act.busy}
                    onClick={() => void act.run(async () => (await unlinkStep(l.id), onRemove(l.id)))}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-bad"
                    aria-label={`Délier « ${s.title} »`}
                    title="Délier"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!stepId || !target) return;
            void act.run(async () => {
              onAdd(await linkStep(stepId, target.contactId, target.personId));
              setStepId("");
            });
          }}
        >
          <select value={stepId} onChange={(e) => setStepId(e.target.value)} className="input min-w-0 flex-[2_1_14rem] py-1.5 text-[13px]" aria-label="Tâche à lier">
            <option value="">Lier une tâche du parcours…</option>
            {groupByPhase(steps.filter((s) => !taken.has(s.id))).map(([phase, list]) => (
              <optgroup key={phase} label={shortPhase(phase)}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {persons.length > 0 && (
            <select value={who} onChange={(e) => setWho(e.target.value)} className="input min-w-0 flex-[1_1_10rem] py-1.5 text-[13px]" aria-label="Avec qui">
              <option value={contact.id}>L&apos;organisme</option>
              {persons.map((p) => (
                <option key={p.id} value={targetValue(contact.id, p.id)}>
                  {personLabel(p)}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={!stepId || act.busy} className="btn btn-sm btn-ghost">
            <IconLink size={14} /> Lier
          </button>
        </form>
      )}
      {act.error && <p className="mt-1 text-[12px] text-bad">{act.error}</p>}
    </div>
  );
}

/** Dans le panneau d'une étape : les organismes et personnes qui peuvent aider. */
export function StepContacts({
  stepId,
  contacts,
  persons,
  links,
  canEdit,
  onAdd,
  onRemove,
}: {
  stepId: string;
  contacts: Contact[];
  persons: ContactPerson[];
  links: ContactStepLink[];
  canEdit: boolean;
  onAdd: (l: ContactStepLink) => void;
  onRemove: (id: string) => void;
}) {
  const [who, setWho] = useState("");
  const act = useAction();
  const orgOf = new Map(contacts.map((c) => [c.id, c]));
  const personOf = new Map(persons.map((p) => [p.id, p]));
  const taken = new Set(links.map((l) => targetValue(l.contactId, l.personId)));

  return (
    <div>
      {links.length === 0 ? (
        <p className="text-[13px] text-faint">Aucun contact lié à cette étape.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((l) => {
            const c = orgOf.get(l.contactId);
            if (!c) return null;
            const p = l.personId ? personOf.get(l.personId) : null;
            const mail = p?.email || (c.contact && contactLink(c.contact)?.kind === "mail" ? c.contact : "");
            const phone = p?.phone || (c.contact && contactLink(c.contact)?.kind === "phone" ? c.contact : "");
            return (
              <li key={l.id} className="flex items-start gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-act-soft text-act">
                  <IconUser size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{p ? personLabel(p) : c.org || "Organisme sans nom"}</p>
                  <p className="truncate text-[12px] text-muted">{p ? c.org : c.role || "Organisme"}</p>
                  {(mail || phone) && (
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px]">
                      {mail && (
                        <a href={`mailto:${mail}`} className="inline-flex min-w-0 items-center gap-1 font-medium text-act hover:underline">
                          <IconMail size={13} className="shrink-0" /> <span className="truncate">{mail}</span>
                        </a>
                      )}
                      {phone && (
                        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-medium text-act hover:underline">
                          <IconPhone size={13} /> {phone}
                        </a>
                      )}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={act.busy}
                    onClick={() => void act.run(async () => (await unlinkStep(l.id), onRemove(l.id)))}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint hover:bg-surface hover:text-bad"
                    aria-label="Délier ce contact"
                    title="Délier"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit &&
        (contacts.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-faint">
            Ajoutez d&apos;abord des organismes dans{" "}
            <Link href="/contacts" className="font-semibold text-act hover:underline">
              Contacts
            </Link>
            .
          </p>
        ) : (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = parseTarget(who);
              if (!t) return;
              void act.run(async () => {
                onAdd(await linkStep(stepId, t.contactId, t.personId));
                setWho("");
              });
            }}
          >
            <select value={who} onChange={(e) => setWho(e.target.value)} className="input min-w-0 flex-1 py-1.5 text-[13px]" aria-label="Contact à lier">
              <option value="">Lier un organisme ou une personne…</option>
              {contacts.map((c) => (
                <optgroup key={c.id} label={c.org || "Organisme sans nom"}>
                  {!taken.has(c.id) && <option value={c.id}>{c.org || "Organisme sans nom"} (l&apos;organisme)</option>}
                  {persons
                    .filter((p) => p.contactId === c.id && !taken.has(targetValue(c.id, p.id)))
                    .map((p) => (
                      <option key={p.id} value={targetValue(c.id, p.id)}>
                        {personLabel(p)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <button type="submit" disabled={!who || act.busy} className="btn btn-sm btn-ghost">
              <IconLink size={14} /> Lier
            </button>
          </form>
        ))}
      {act.error && <p className="mt-1 text-[12px] text-bad">{act.error}</p>}
      {links.length > 0 && (
        <Link href="/contacts" className="mt-3 inline-block text-[12.5px] font-semibold text-act hover:underline">
          Voir le réseau complet
        </Link>
      )}
    </div>
  );
}

function groupByPhase(steps: StepLite[]): Array<[string, StepLite[]]> {
  const m = new Map<string, StepLite[]>();
  for (const s of steps) m.set(s.phase, [...(m.get(s.phase) ?? []), s]);
  return [...m.entries()];
}
