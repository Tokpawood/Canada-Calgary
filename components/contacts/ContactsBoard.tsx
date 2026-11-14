"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/rules";
import type { Contact } from "@/lib/types";
import { newId } from "@/lib/ids";
import { changedFields } from "@/components/editable";
import { ConfirmButton, EmptyState, Field, PageHeader } from "@/components/ui";
import { IconArrowRight, IconCheck, IconGlobe, IconMail, IconPencil, IconPhone, IconPlus, IconTrash, IconUser, IconUsers } from "@/components/icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d][\d\s().-]{6,}$/;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

function contactLink(raw: string): { href: string; kind: "mail" | "phone" | "web" } | null {
  const v = raw.trim();
  if (EMAIL_RE.test(v)) return { href: `mailto:${v}`, kind: "mail" };
  if (PHONE_RE.test(v)) return { href: `tel:${v.replace(/[^\d+]/g, "")}`, kind: "phone" };
  const url = safeUrl(v) ?? (DOMAIN_RE.test(v) ? safeUrl(`https://${v}`) : null);
  return url ? { href: url, kind: "web" } : null;
}

export function ContactsBoard({ dossierId, initialContacts }: { dossierId: string; initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [editing, setEditing] = useState<string | null>(null);
  /** Contact ajouté mais pas encore enregistré en base. */
  const [pendingNew, setPendingNew] = useState<string | null>(null);
  const supabase = createClient();

  function addContact() {
    if (editing) return;
    const id = newId("c");
    setContacts((prev) => [...prev, { id, dossierId, org: "", role: "", contact: "", person: "", next: "", notes: "" }]);
    setPendingNew(id);
    setEditing(id);
  }

  async function saveContact(before: Contact, after: Contact) {
    const fields = { org: after.org, role: after.role, contact: after.contact, person: after.person, next: after.next, notes: after.notes };
    if (pendingNew === after.id) {
      const { error } = await supabase.from("contact").insert({ id: after.id, dossier_id: dossierId, position: contacts.length - 1, ...fields });
      if (error) throw error;
      setPendingNew(null);
    } else {
      const patch = changedFields(before, after, ["org", "role", "contact", "person", "next", "notes"]);
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
    if (pendingNew !== id) await supabase.from("contact").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setPendingNew(null);
    setEditing(null);
  }

  const withNext = contacts.filter((c) => c.next.trim()).length;

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`Organismes et interlocuteurs du dossier${withNext ? ` · ${withNext} action(s) en attente` : ""}.`}
        actions={
          <button type="button" onClick={addContact} disabled={editing !== null} className="btn btn-primary">
            <IconPlus size={16} /> Contact
          </button>
        }
      />

      {contacts.length === 0 ? (
        <EmptyState icon={<IconUsers size={20} />} title="Aucun contact">
          Ajoutez les organismes avec lesquels vous échangez : ambassade, école, employeur, centre de tests…
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {contacts.map((c) =>
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
              <ContactCard key={c.id} contact={c} canEdit={editing === null} onEdit={() => setEditing(c.id)} />
            ),
          )}
        </div>
      )}
    </>
  );
}

function ContactCard({ contact: c, onEdit, canEdit }: { contact: Contact; onEdit: () => void; canEdit: boolean }) {
  const link = c.contact ? contactLink(c.contact) : null;
  const LinkIcon = link?.kind === "mail" ? IconMail : link?.kind === "phone" ? IconPhone : IconGlobe;

  return (
    <article className="card group flex flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-act-soft font-display text-[15px] font-bold text-act">
          {(c.org.trim()[0] ?? "?").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold">{c.org || "Organisme sans nom"}</h2>
          {c.role && <p className="text-[12.5px] text-muted">{c.role}</p>}
        </div>
        <button type="button" onClick={onEdit} disabled={!canEdit} aria-label={`Modifier ${c.org || "le contact"}`} className="btn btn-sm btn-ghost shrink-0">
          <IconPencil size={14} /> Modifier
        </button>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 text-[13.5px]">
        {c.contact && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Contact</dt>
            <LinkIcon size={15} className="shrink-0 text-faint" />
            <dd className="min-w-0 truncate">
              {link ? (
                <a href={link.href} target={link.kind === "web" ? "_blank" : undefined} rel="noopener noreferrer" className="font-medium text-act hover:underline">
                  {c.contact}
                </a>
              ) : (
                c.contact
              )}
            </dd>
          </div>
        )}
        {c.person && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Interlocuteur</dt>
            <IconUser size={15} className="shrink-0 text-faint" />
            <dd>{c.person}</dd>
          </div>
        )}
      </dl>

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
    </article>
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
        <Field label="Rôle">
          <input value={c.role} onChange={(e) => onChange({ role: e.target.value })} className="input" />
        </Field>
        <Field label="Contact" hint="Courriel, téléphone ou site web">
          <input value={c.contact} onChange={(e) => onChange({ contact: e.target.value })} className="input" />
        </Field>
        <Field label="Interlocuteur">
          <input value={c.person} onChange={(e) => onChange({ person: e.target.value })} className="input" />
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
