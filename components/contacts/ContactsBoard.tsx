"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";
import type { ContactPerson, ContactStepLink, StepLite } from "@/lib/network";
import { newId } from "@/lib/ids";
import { changedFields } from "@/components/editable";
import { ConfirmButton, EmptyState, Field, PageHeader } from "@/components/ui";
import { IconArrowRight, IconCheck, IconGlobe, IconLink, IconMail, IconPencil, IconPhone, IconPlus, IconSearch, IconTrash, IconUser, IconUsers } from "@/components/icons";
import { DarkHeader, DarkTiles, HeaderTabs, useHashTab } from "@/components/DarkHeader";
import { CopyButton } from "@/components/profil/FieldGrid";
import { contactLink } from "./contactLink";
import { OrgTeam } from "./OrgTeam";
import { ContactSteps } from "./Links";

const TABS = ["organismes", "reseau", "a-relancer"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  dossierId: string;
  initialContacts: Contact[];
  initialPersons: ContactPerson[];
  initialLinks: ContactStepLink[];
  steps: StepLite[];
}

export function ContactsBoard({ dossierId, initialContacts, initialPersons, initialLinks, steps }: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [persons, setPersons] = useState(initialPersons);
  const [links, setLinks] = useState(initialLinks);
  const [editing, setEditing] = useState<string | null>(null);
  /** Organisme ajouté mais pas encore enregistré en base. */
  const [pendingNew, setPendingNew] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useHashTab<Tab>(TABS, "organismes");
  const supabase = createClient();

  function addContact() {
    if (editing) return;
    const id = newId("c");
    setContacts((prev) => [{ id, dossierId, org: "", role: "", contact: "", person: "", next: "", notes: "" }, ...prev]);
    setPendingNew(id);
    setEditing(id);
  }

  async function saveContact(before: Contact, after: Contact) {
    const fields = { org: after.org, role: after.role, contact: after.contact, next: after.next, notes: after.notes };
    if (pendingNew === after.id) {
      const { error } = await supabase.from("contact").insert({ id: after.id, dossier_id: dossierId, position: contacts.length - 1, ...fields });
      if (error) throw error;
      setPendingNew(null);
    } else {
      const patch = changedFields(before, after, ["org", "role", "contact", "next", "notes"]);
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("contact").update(patch).eq("id", after.id);
        if (error) throw error;
      }
    }
    setContacts((prev) => prev.map((c) => (c.id === after.id ? after : c)));
    setEditing(null);
  }

  function cancelEdit(id: string) {
    if (pendingNew === id) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setPendingNew(null);
    }
    setEditing(null);
  }

  async function deleteContact(id: string) {
    if (pendingNew !== id) {
      const { error } = await supabase.from("contact").delete().eq("id", id);
      if (error) throw error;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setPersons((prev) => prev.filter((p) => p.contactId !== id));
    setLinks((prev) => prev.filter((l) => l.contactId !== id));
    setPendingNew(null);
    setEditing(null);
  }

  /** Une personne retirée emporte ses liens vers les étapes (cascade en base). */
  function setOrgPersons(contactId: string, next: ContactPerson[]) {
    const kept = new Set(next.map((p) => p.id));
    setPersons((prev) => [...prev.filter((p) => p.contactId !== contactId), ...next]);
    setLinks((prev) => prev.filter((l) => l.contactId !== contactId || !l.personId || kept.has(l.personId)));
  }

  const withNext = contacts.filter((c) => c.next.trim()).length;
  const linkedSteps = new Set(links.map((l) => l.stepId)).size;
  const orgName = new Map(contacts.map((c) => [c.id, c.org || "Sans nom"]));

  const q = query.trim().toLowerCase();
  const orgText = (c: Contact) =>
    `${c.org} ${c.role} ${c.contact} ${c.next} ${c.notes} ${persons
      .filter((p) => p.contactId === c.id)
      .map((p) => `${p.name} ${p.title} ${p.email} ${p.phone}`)
      .join(" ")}`.toLowerCase();
  const matches = (c: Contact) => pendingNew === c.id || editing === c.id || !q || orgText(c).includes(q);
  const visible = contacts.filter((c) => matches(c) && (tab !== "a-relancer" || c.next.trim() || editing === c.id));
  const visiblePeople = persons
    .filter((p) => !q || `${p.name} ${p.title} ${p.email} ${p.phone} ${orgName.get(p.contactId) ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => (orgName.get(a.contactId) ?? "").localeCompare(orgName.get(b.contactId) ?? "", "fr") || a.name.localeCompare(b.name, "fr"));
  const shown = tab === "reseau" ? visiblePeople.length : visible.length;
  const total = tab === "reseau" ? persons.length : contacts.length;

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Organismes, personnes qui peuvent vous aider et tâches où elles interviennent."
        actions={
          <button
            type="button"
            onClick={() => {
              if (tab === "reseau") setTab("organismes");
              addContact();
            }}
            disabled={editing !== null}
            className="btn btn-primary"
          >
            <IconPlus size={16} /> Organisme
          </button>
        }
      />

      <DarkHeader
        aside={
          <DarkTiles
            items={[
              { label: "Actions en attente", value: String(withNext), sub: withNext ? "prochaines actions à mener" : "rien à relancer", tone: withNext ? "signal" : undefined },
              { label: "Tâches liées", value: String(linkedSteps), unit: `/ ${steps.length}`, sub: "étapes avec un contact", pct: steps.length ? (linkedSteps / steps.length) * 100 : 0, tone: "ok" },
            ]}
          />
        }
        tabs={
          <HeaderTabs
            label="Vues des contacts"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "organismes", label: "Organismes", icon: <IconUsers size={15} />, badge: { text: String(contacts.length) }, dirty: editing !== null },
              { id: "reseau", label: "Réseau", icon: <IconUser size={15} />, badge: persons.length ? { text: String(persons.length) } : null },
              { id: "a-relancer", label: "À relancer", icon: <IconArrowRight size={15} />, badge: withNext ? { text: String(withNext), tone: "signal" } : null },
            ]}
          />
        }
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Réseau du dossier</p>
        <p className="mt-1 font-display text-[44px] leading-none font-extrabold tracking-tight sm:text-[52px]">
          {persons.length}
          <span className="ml-2 text-[20px] font-bold text-signal">personne{persons.length > 1 ? "s" : ""}</span>
        </p>
        <p className="mt-2 text-[13px] text-night-muted">
          dans {contacts.length} organisme{contacts.length > 1 ? "s" : ""}
          {links.length ? ` · ${links.length} lien${links.length > 1 ? "s" : ""} avec le parcours` : ""}
        </p>
        {contacts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {contacts.slice(0, 8).map((c) => (
              <span key={c.id} className="rounded-md bg-white/10 px-2 py-0.5 text-[12px] font-semibold">
                {c.org || "Sans nom"}
                <span className="ml-1 font-normal text-night-muted">{persons.filter((p) => p.contactId === c.id).length || ""}</span>
              </span>
            ))}
            {contacts.length > 8 && <span className="px-1 text-[12px] text-night-muted">+{contacts.length - 8}</span>}
          </div>
        )}
      </DarkHeader>

      <div className="mt-5" role="tabpanel">
        {contacts.length > 0 && (
          <div className="card mb-4 flex items-center gap-2 px-3 py-2">
            <IconSearch size={16} className="shrink-0 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un organisme, une personne, une fonction…"
              aria-label="Rechercher un contact"
              className="min-w-0 flex-1 bg-transparent py-1 text-[14px] outline-none placeholder:text-faint"
            />
            <span className="mono shrink-0 text-[12px] text-muted">
              {shown} / {total}
            </span>
          </div>
        )}

        {contacts.length === 0 ? (
          <EmptyState icon={<IconUsers size={20} />} title="Aucun organisme">
            Ajoutez les organismes avec lesquels vous échangez (ambassade, école, employeur, centre de tests…), puis les personnes qui peuvent vous aider dans chacun.
          </EmptyState>
        ) : tab === "reseau" ? (
          visiblePeople.length === 0 ? (
            <EmptyState icon={<IconUser size={20} />} title={q ? "Aucune personne trouvée" : "Aucune personne"}>
              {q ? "Essayez une autre recherche." : "Ouvrez un organisme et ajoutez-y les personnes qui peuvent vous aider."}
            </EmptyState>
          ) : (
            <PeopleTable
              persons={visiblePeople}
              all={persons}
              orgName={orgName}
              linkCount={(id) => links.filter((l) => l.personId === id).length}
              onOpenOrg={(contactId) => {
                setQuery("");
                setTab("organismes");
                requestAnimationFrame(() => document.getElementById(`org-${contactId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
              }}
            />
          )
        ) : visible.length === 0 ? (
          <EmptyState icon={<IconUsers size={20} />} title={tab === "a-relancer" && !q ? "Rien à relancer" : "Aucun organisme trouvé"}>
            {tab === "a-relancer" && !q ? "Aucun organisme n'a de prochaine action." : "Essayez une autre recherche."}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visible.map((c) =>
              editing === c.id ? (
                <ContactEditor
                  key={c.id}
                  contact={c}
                  isNew={pendingNew === c.id}
                  onSave={(after) => saveContact(c, after)}
                  onCancel={() => cancelEdit(c.id)}
                  onDelete={() => deleteContact(c.id)}
                />
              ) : (
                <OrgCard
                  key={c.id}
                  contact={c}
                  persons={persons.filter((p) => p.contactId === c.id)}
                  links={links.filter((l) => l.contactId === c.id)}
                  steps={steps}
                  canEdit={editing === null}
                  onEdit={() => setEditing(c.id)}
                  onPersons={(next) => setOrgPersons(c.id, next)}
                  onLinkAdd={(l) => setLinks((prev) => [...prev, l])}
                  onLinkRemove={(id) => setLinks((prev) => prev.filter((l) => l.id !== id))}
                />
              ),
            )}
          </div>
        )}
      </div>
    </>
  );
}

function OrgCard({
  contact: c,
  persons,
  links,
  steps,
  canEdit,
  onEdit,
  onPersons,
  onLinkAdd,
  onLinkRemove,
}: {
  contact: Contact;
  persons: ContactPerson[];
  links: ContactStepLink[];
  steps: StepLite[];
  canEdit: boolean;
  onEdit: () => void;
  onPersons: (next: ContactPerson[]) => void;
  onLinkAdd: (l: ContactStepLink) => void;
  onLinkRemove: (id: string) => void;
}) {
  const link = c.contact ? contactLink(c.contact) : null;
  const LinkIcon = link?.kind === "mail" ? IconMail : link?.kind === "phone" ? IconPhone : IconGlobe;

  return (
    <article id={`org-${c.id}`} className="card flex scroll-mt-4 flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-act-soft font-display text-[15px] font-bold text-act">{(c.org.trim()[0] ?? "?").toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold">{c.org || "Organisme sans nom"}</h2>
          {c.role && <p className="text-[12.5px] text-muted">{c.role}</p>}
          {c.contact && (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px]">
              <LinkIcon size={14} className="shrink-0 text-faint" />
              {link ? (
                <a href={link.href} target={link.kind === "web" ? "_blank" : undefined} rel="noopener noreferrer" className="truncate font-medium text-act hover:underline">
                  {c.contact}
                </a>
              ) : (
                <span className="truncate">{c.contact}</span>
              )}
              <CopyButton text={c.contact} label={`contact ${c.org}`} />
            </p>
          )}
        </div>
        <button type="button" onClick={onEdit} disabled={!canEdit} aria-label={`Modifier ${c.org || "l'organisme"}`} className="btn btn-sm btn-ghost shrink-0">
          <IconPencil size={14} /> Modifier
        </button>
      </div>

      {c.next && (
        <div className="mt-3 flex gap-2 rounded-xl bg-signal-soft px-3 py-2.5 text-[13px]">
          <IconArrowRight size={15} className="mt-0.5 shrink-0 text-opt" />
          <p>
            <span className="font-semibold text-opt">Prochaine action · </span>
            {c.next}
          </p>
        </div>
      )}
      {c.notes && <p className="mt-3 text-[12.5px] whitespace-pre-line text-muted">{c.notes}</p>}

      <section className="mt-4 border-t border-line pt-3">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          <IconUsers size={14} /> Équipe {persons.length > 0 && <span className="mono font-normal">· {persons.length}</span>}
        </h3>
        <OrgTeam contactId={c.id} persons={persons} canEdit={canEdit} stepCount={(id) => links.filter((l) => l.personId === id).length} onChange={onPersons} />
      </section>

      <section className="mt-4 border-t border-line pt-3">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          <IconLink size={14} /> Tâches liées {links.length > 0 && <span className="mono font-normal">· {links.length}</span>}
        </h3>
        <ContactSteps contact={c} persons={persons} links={links} steps={steps} canEdit={canEdit} onAdd={onLinkAdd} onRemove={onLinkRemove} />
      </section>
    </article>
  );
}

function PeopleTable({
  persons,
  all,
  orgName,
  linkCount,
  onOpenOrg,
}: {
  persons: ContactPerson[];
  all: ContactPerson[];
  orgName: Map<string, string>;
  linkCount: (personId: string) => number;
  onOpenOrg: (contactId: string) => void;
}) {
  const nameOf = new Map(all.map((p) => [p.id, p.name]));
  return (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] text-muted">
              <th className="px-4 py-2 font-medium sm:px-5">Personne</th>
              <th className="px-3 py-2 font-medium">Organisme</th>
              <th className="px-3 py-2 font-medium">Coordonnées</th>
              <th className="px-4 py-2 text-right font-medium sm:px-5">Tâches</th>
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="block font-semibold">{p.name}</span>
                  {(p.title || p.parentId) && (
                    <span className="block text-[12px] text-muted">
                      {p.title}
                      {p.parentId && nameOf.get(p.parentId) ? `${p.title ? " · " : ""}rattachée à ${nameOf.get(p.parentId)}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpenOrg(p.contactId)} className="text-left font-medium text-act hover:underline">
                    {orgName.get(p.contactId)}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex flex-col gap-0.5">
                    {p.email && (
                      <span className="flex items-center gap-1">
                        <a href={`mailto:${p.email}`} className="truncate font-medium text-act hover:underline">
                          {p.email}
                        </a>
                        <CopyButton text={p.email} label={`courriel ${p.name}`} />
                      </span>
                    )}
                    {p.phone && (
                      <span className="flex items-center gap-1">
                        <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-act hover:underline">
                          {p.phone}
                        </a>
                        <CopyButton text={p.phone} label={`téléphone ${p.name}`} />
                      </span>
                    )}
                    {!p.email && !p.phone && <span className="text-faint">—</span>}
                  </span>
                </td>
                <td className="mono px-4 py-2.5 text-right sm:px-5">{linkCount(p.id) || <span className="text-faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ContactEditor({
  contact,
  isNew,
  onSave,
  onCancel,
  onDelete,
}: {
  contact: Contact;
  isNew: boolean;
  onSave: (after: Contact) => Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [c, setC] = useState(contact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onChange = (p: Partial<Contact>) => setC((prev) => ({ ...prev, ...p }));
  const dirty = isNew || JSON.stringify(c) !== JSON.stringify(contact);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué.");
      setSaving(false);
    }
  }

  return (
    <article className="card anim-fade p-4 ring-2 ring-act-soft sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Organisme">
          <input autoFocus value={c.org} onChange={(e) => onChange({ org: e.target.value })} className="input" />
        </Field>
        <Field label="Type / rôle">
          <input value={c.role} onChange={(e) => onChange({ role: e.target.value })} className="input" />
        </Field>
        <Field label="Contact général" hint="Courriel, téléphone ou site web" className="sm:col-span-2">
          <input value={c.contact} onChange={(e) => onChange({ contact: e.target.value })} className="input" />
        </Field>
        <Field label="Prochaine action" className="sm:col-span-2">
          <input value={c.next} onChange={(e) => onChange({ next: e.target.value })} className="input" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea value={c.notes} onChange={(e) => onChange({ notes: e.target.value })} className="input" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {isNew ? (
          <span />
        ) : (
          <ConfirmButton label="Supprimer le contact" onConfirm={onDelete}>
            <IconTrash size={13} /> Supprimer
          </ConfirmButton>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {error && <span className="text-[12px] text-bad">{error}</span>}
          <button type="button" onClick={onCancel} disabled={saving} className="btn btn-sm btn-ghost">
            Annuler
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !dirty} className="btn btn-sm btn-primary">
            <IconCheck size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </article>
  );
}
