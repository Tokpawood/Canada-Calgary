"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";

export function ContactsBoard({ dossierId, initialContacts }: { dossierId: string; initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const supabase = createClient();

  async function addContact() {
    const id = `c-${Date.now().toString(36)}`;
    setContacts((prev) => [...prev, { id, dossierId, org: "", role: "", contact: "", person: "", next: "", notes: "" }]);
    await supabase.from("contact").insert({ id, dossier_id: dossierId, position: contacts.length });
  }

  async function updateContact(id: string, patch: Partial<Contact>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("contact").update(patch).eq("id", id);
  }

  async function deleteContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("contact").delete().eq("id", id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" onClick={addContact} className="rounded-lg bg-act px-3 py-1.5 text-sm font-semibold text-act-ink">
          + Contact
        </button>
      </div>
      {contacts.map((c) => (
        <div key={c.id} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Organisme" value={c.org} onChange={(v) => updateContact(c.id, { org: v })} />
            <Field label="Rôle" value={c.role} onChange={(v) => updateContact(c.id, { role: v })} />
            <Field label="Contact" value={c.contact} onChange={(v) => updateContact(c.id, { contact: v })} />
            <Field label="Interlocuteur" value={c.person} onChange={(v) => updateContact(c.id, { person: v })} />
            <Field label="Prochaine action" value={c.next} onChange={(v) => updateContact(c.id, { next: v })} />
            <Field label="Notes" value={c.notes} onChange={(v) => updateContact(c.id, { notes: v })} />
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => deleteContact(c.id)} className="text-xs text-faint hover:text-bad">
              Supprimer
            </button>
          </div>
        </div>
      ))}
      {contacts.length === 0 && <p className="text-sm text-muted">Aucun contact enregistré.</p>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-medium text-muted">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-md border border-line px-2 py-1 text-sm text-ink" />
    </label>
  );
}
