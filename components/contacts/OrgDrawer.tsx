"use client";

import { useMemo, useState } from "react";
import type { Contact, ContactStage } from "@/lib/types";
import { CONTACT_STAGES, type ContactPerson, type ContactStepLink, type StepLite } from "@/lib/network";
import { ConfirmButton, Drawer, Field } from "@/components/ui";
import { EditBar, useEditable } from "@/components/editable";
import { HeaderTabs } from "@/components/DarkHeader";
import { DarkStatusPicker, DrawerCard, DrawerFacts, DrawerTitle, ReadRow } from "@/components/DrawerParts";
import { IconArrowRight, IconTrash } from "@/components/icons";
import { CopyButton } from "@/components/profil/FieldGrid";
import { contactLink } from "./contactLink";
import { OrgTeam } from "./OrgTeam";
import { ContactSteps } from "./Links";
import { PhotoBadge, PhotoPicker, type Photo } from "./PhotoPicker";

export type OrgTab = "equipe" | "taches" | "infos";
type OrgDraft = Pick<Contact, "org" | "role" | "contact" | "next" | "notes" | "stage">;

export const STAGE_DOT: Record<ContactStage, string> = {
  "a-contacter": "bg-faint",
  "en-contact": "bg-run",
  "en-attente": "bg-opt",
  etabli: "bg-ok",
  termine: "bg-muted",
};
const stageLabel = (s: ContactStage) => CONTACT_STAGES.find((x) => x.id === s)?.label ?? s;
const stageOf = (label: string) => CONTACT_STAGES.find((x) => x.label === label)?.id ?? "a-contacter";

interface Props {
  dossierId: string;
  onOpenPerson: (personId: string) => void;
  /** Logo changé (chemin et lien signé), ou retiré. */
  onPhoto: (photo: Photo) => void;
  contact: Contact;
  persons: ContactPerson[];
  links: ContactStepLink[];
  steps: StepLite[];
  initialTab?: OrgTab;
  onSave: (patch: Partial<Contact>) => Promise<void>;
  onDelete: () => Promise<void>;
  onPersons: (next: ContactPerson[]) => void;
  onLinkAdd: (l: ContactStepLink) => void;
  onLinkRemove: (id: string) => void;
  onOpenStep: (stepId: string) => void;
  onClose: () => void;
}

/** Fiche d'un organisme : équipe (organigramme), tâches liées et informations, modifiables. */
export function OrgDrawer({ dossierId, onOpenPerson, onPhoto, contact: c, persons, links, steps, initialTab = "equipe", onSave, onDelete, onPersons, onLinkAdd, onLinkRemove, onOpenStep, onClose }: Props) {
  const [tab, setTab] = useState<OrgTab>(initialTab);
  const [warn, setWarn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stageBusy, setStageBusy] = useState(false);
  const saved: OrgDraft = useMemo(() => ({ org: c.org, role: c.role, contact: c.contact, next: c.next, notes: c.notes, stage: c.stage }), [c]);
  const ed = useEditable(saved, async (d) => {
    const patch: Partial<Contact> = {};
    for (const k of Object.keys(d) as Array<keyof OrgDraft>) if (d[k] !== saved[k]) Object.assign(patch, { [k]: d[k] });
    await onSave(patch);
    setWarn(false);
  });
  const v = ed.current;
  const link = c.contact ? contactLink(c.contact) : null;
  const doneSteps = links.filter((l) => steps.find((s) => s.id === l.stepId)?.status === "Fait").length;

  function guardedClose() {
    if (ed.dirty) return setWarn(true);
    onClose();
  }

  async function quickStage(label: string) {
    setStageBusy(true);
    setActionError(null);
    try {
      await onSave({ stage: stageOf(label) });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Changement d'étape impossible.");
    } finally {
      setStageBusy(false);
    }
  }

  async function remove() {
    setActionError(null);
    try {
      await onDelete();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Suppression impossible.");
    }
  }

  return (
    <Drawer
      label={`Organisme : ${c.org || "sans nom"}`}
      onClose={guardedClose}
      header={
        <>
          <div className="flex items-center gap-4 pr-24">
            <PhotoBadge url={c.photoUrl} label={(c.org.trim()[0] ?? "?").toUpperCase()} shape="square" size={60} className="ring-2 ring-white/15" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">{v.role || "Organisme"}</p>
              <DrawerTitle value={v.org} editing={ed.editing} onChange={(org) => ed.set({ org })} label="Nom de l'organisme" />
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {ed.editing ? (
              <DarkStatusPicker
                options={CONTACT_STAGES.map((s) => s.label)}
                value={stageLabel(v.stage)}
                editing
                onChange={(l) => ed.set({ stage: stageOf(l) })}
                dotClass={(l) => STAGE_DOT[stageOf(l)]}
                label="Étape de la relation"
              />
            ) : (
              <select
                value={stageLabel(c.stage)}
                onChange={(e) => void quickStage(e.target.value)}
                disabled={stageBusy}
                aria-label="Étape de la relation"
                className="min-h-8 rounded-full disabled:opacity-60 border-0 bg-white/10 px-3 py-1 text-[12px] font-semibold text-night-ink outline-none focus:ring-2 focus:ring-signal"
              >
                {CONTACT_STAGES.map((s) => (
                  <option key={s.id} value={s.label} className="text-ink">
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            {!ed.editing && c.contact && (
              <span className="flex min-w-0 items-center gap-1 text-[12.5px] text-night-muted">
                {link ? (
                  <a href={link.href} target={link.kind === "web" ? "_blank" : undefined} rel="noopener noreferrer" className="truncate font-semibold text-night-ink hover:underline">
                    {c.contact}
                  </a>
                ) : (
                  <span className="truncate">{c.contact}</span>
                )}
              </span>
            )}
          </div>
          <DrawerFacts
            items={[
              { label: "Personnes", value: String(persons.length) },
              { label: "Tâches liées", value: links.length ? `${doneSteps}/${links.length} faites` : "—" },
              { label: "Prochaine action", value: c.next || "—" },
            ]}
          />
        </>
      }
      tabs={
        <HeaderTabs
          label="Sections de l'organisme"
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "equipe", label: "Équipe", badge: persons.length ? { text: String(persons.length) } : null },
            { id: "taches", label: "Tâches", badge: links.length ? { text: String(links.length) } : null },
            { id: "infos", label: "Infos", badge: c.next ? { text: "!", tone: "signal" } : null },
          ]}
        />
      }
      footer={
        <div>
          {warn && <p className="mb-2 text-[12.5px] font-semibold text-bad">Modifications non enregistrées : enregistrez-les ou annulez avant de fermer.</p>}
          {actionError && (
            <p role="alert" className="mb-2 text-[12.5px] font-semibold text-bad">
              {actionError}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {ed.editing ? (
              <span className="text-[12.5px] font-semibold text-opt">Modification en cours</span>
            ) : (
              <ConfirmButton label="Supprimer l'organisme" confirmLabel={persons.length ? `Supprimer avec ${persons.length} personne${persons.length > 1 ? "s" : ""}` : "Supprimer l'organisme"} onConfirm={() => void remove()}>
                <IconTrash size={14} />
                <span className="hidden sm:inline">Supprimer</span>
              </ConfirmButton>
            )}
            <EditBar edit={ed} label="Modifier l'organisme" />
          </div>
        </div>
      }
    >
      {c.next && !ed.editing && tab !== "infos" && (
        <button type="button" onClick={() => setTab("infos")} className="mb-4 flex w-full gap-2 rounded-xl bg-signal-soft px-3 py-2.5 text-left text-[13px]">
          <IconArrowRight size={15} className="mt-0.5 shrink-0 text-opt" />
          <span>
            <span className="font-semibold text-opt">Prochaine action · </span>
            {c.next}
          </span>
        </button>
      )}

      {tab === "equipe" && (
        <DrawerCard title="Équipe" sub="Les personnes qui peuvent vous aider, rangées sous leur responsable.">
          <OrgTeam dossierId={dossierId} onOpenPerson={onOpenPerson} contactId={c.id} persons={persons} canEdit={!ed.editing} stepCount={(id) => links.filter((l) => l.personId === id).length} onChange={onPersons} />
        </DrawerCard>
      )}

      {tab === "taches" && (
        <DrawerCard title="Tâches liées" sub="Étapes du parcours où cet organisme, ou l'une de ses personnes, intervient.">
          <ContactSteps contact={c} persons={persons} links={links} steps={steps} canEdit={!ed.editing} onAdd={onLinkAdd} onRemove={onLinkRemove} onOpenStep={onOpenStep} />
        </DrawerCard>
      )}

      {tab === "infos" && (
        <div className="flex flex-col gap-4">
        <div className="px-1">
          <PhotoPicker
            dossierId={dossierId}
            kind="org"
            id={c.id}
            url={c.photoUrl}
            path={c.photoPath}
            label={(c.org.trim()[0] ?? "?").toUpperCase()}
            suggestedUrl={link?.kind === "web" ? c.contact : ""}
            onChange={onPhoto}
          />
        </div>
        <DrawerCard title="Informations">
          {ed.editing ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Type / rôle">
                <input value={v.role} onChange={(e) => ed.set({ role: e.target.value })} placeholder="Ambassade, école, employeur…" className="input" />
              </Field>
              <Field label="Contact général" hint="Courriel, téléphone ou site web">
                <input value={v.contact} onChange={(e) => ed.set({ contact: e.target.value })} className="input" />
              </Field>
              <Field label="Prochaine action" className="sm:col-span-2">
                <input value={v.next} onChange={(e) => ed.set({ next: e.target.value })} className="input" />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <textarea value={v.notes} onChange={(e) => ed.set({ notes: e.target.value })} rows={4} className="input" />
              </Field>
            </div>
          ) : (
            <dl className="m-0">
              <ReadRow label="Type / rôle" value={c.role} />
              <ReadRow
                label="Contact général"
                value={
                  c.contact ? (
                    <span className="flex items-center gap-1">
                      {link ? (
                        <a href={link.href} target={link.kind === "web" ? "_blank" : undefined} rel="noopener noreferrer" className="truncate text-act hover:underline">
                          {c.contact}
                        </a>
                      ) : (
                        c.contact
                      )}
                      <CopyButton text={c.contact} label={`contact ${c.org}`} />
                    </span>
                  ) : (
                    ""
                  )
                }
              />
              <ReadRow label="Étape" value={stageLabel(c.stage)} />
              <ReadRow label="Prochaine action" value={c.next} />
              <ReadRow label="Notes" value={c.notes} />
            </dl>
          )}
        </DrawerCard>
        </div>
      )}
    </Drawer>
  );
}
