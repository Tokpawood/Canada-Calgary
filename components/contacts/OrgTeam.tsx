"use client";

import { useState } from "react";
import { canReportTo, orgChart, personLabel, type ContactPerson } from "@/lib/network";
import { addPerson, type PersonDraft } from "@/lib/networkClient";
import { ConfirmButton, Field } from "@/components/ui";
import { IconCheck, IconMail, IconPencil, IconPhone, IconPlus, IconTrash } from "@/components/icons";
import { initials } from "./contactLink";
import { PhotoBadge } from "./PhotoPicker";

interface Props {
  dossierId: string;
  contactId: string;
  /** Ouvre la fiche complète d'une personne. */
  onOpenPerson: (personId: string) => void;
  persons: ContactPerson[];
  /** Nombre d'étapes liées à chaque personne. */
  stepCount: (personId: string) => number;
  canEdit: boolean;
  onChange: (persons: ContactPerson[]) => void;
}

type Editing = { kind: "new"; parentId: string | null } | null;

/** Équipe d'un organisme en mini-organigramme : chaque personne sous son responsable. */
export function OrgTeam({ dossierId, contactId, onOpenPerson, persons, stepCount, canEdit, onChange }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const chart = orgChart(persons);

  async function save(draft: PersonDraft) {
    const p = await addPerson(dossierId, contactId, draft, persons.length);
    onChange([...persons, p]);
    setEditing(null);
  }

  return (
    <div>
      {chart.length === 0 && editing?.kind !== "new" && <p className="text-[13px] text-faint">Personne pour l&apos;instant : ajoutez les gens qui peuvent vous aider ici.</p>}
      <ul className="flex flex-col">
        {chart.map(({ person: p, depth, reports }) => (
          <li key={p.id} style={{ paddingLeft: Math.min(depth, 4) * 22 }}>
            <div className={depth > 0 ? "relative border-l-2 border-line pl-3" : ""}>
              {depth > 0 && <span aria-hidden className="absolute top-5 left-0 h-0.5 w-2.5 bg-line" />}
              <PersonRow
                person={p}
                reports={reports}
                steps={stepCount(p.id)}
                canEdit={canEdit && editing === null}
                onOpen={() => onOpenPerson(p.id)}
                onAddBelow={() => setEditing({ kind: "new", parentId: p.id })}
              />
              {editing?.kind === "new" && editing.parentId === p.id && (
                <div className="relative ml-[22px] border-l-2 border-act/40 pl-3">
                  <PersonForm persons={persons} initial={{ parentId: p.id }} onSave={save} onCancel={() => setEditing(null)} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing?.kind === "new" && editing.parentId === null && <PersonForm persons={persons} initial={{ parentId: null }} onSave={save} onCancel={() => setEditing(null)} />}
      {canEdit && editing === null && (
        <button type="button" onClick={() => setEditing({ kind: "new", parentId: null })} className="btn btn-ghost btn-sm mt-2">
          <IconPlus size={14} /> Ajouter une personne
        </button>
      )}
    </div>
  );
}

function PersonRow({
  person: p,
  reports,
  steps,
  canEdit,
  onOpen,
  onAddBelow,
}: {
  person: ContactPerson;
  reports: number;
  steps: number;
  canEdit: boolean;
  onOpen: () => void;
  onAddBelow: () => void;
}) {
  const tel = p.phone.replace(/[^\d+]/g, "");
  return (
    <div className="group flex items-start gap-2.5 rounded-xl py-1.5 pr-1">
      <button type="button" onClick={onOpen} className="mt-0.5 shrink-0 rounded-full" aria-label={`Fiche de ${p.name}`}>
        <PhotoBadge url={p.photoUrl} label={initials(p.name)} shape="circle" size={34} />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block max-w-full truncate text-left text-[14px] font-semibold hover:text-act hover:underline">
          {p.name}
          {p.title && <span className="font-normal text-muted"> · {p.title}</span>}
        </button>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]">
          {p.email && (
            <a href={`mailto:${p.email}`} className="inline-flex min-w-0 items-center gap-1 font-medium text-act hover:underline">
              <IconMail size={13} className="shrink-0" />
              <span className="truncate">{p.email}</span>
            </a>
          )}
          {p.phone && (
            <a href={tel ? `tel:${tel}` : undefined} className="inline-flex items-center gap-1 font-medium text-act hover:underline">
              <IconPhone size={13} /> {p.phone}
            </a>
          )}
          {reports > 0 && <span className="text-faint">{reports} sous sa responsabilité</span>}
          {steps > 0 && (
            <span className="text-faint">
              {steps} tâche{steps > 1 ? "s" : ""}
            </span>
          )}
        </p>
        {p.notes && <p className="mt-0.5 text-[12.5px] whitespace-pre-line text-muted">{p.notes}</p>}
      </div>
      {canEdit && (
        <span className="flex shrink-0 gap-1">
          <button type="button" onClick={onAddBelow} className="btn btn-ghost btn-sm px-2" aria-label={`Ajouter une personne sous ${p.name}`} title="Ajouter une personne sous elle">
            <IconPlus size={14} />
          </button>
          <button type="button" onClick={onOpen} className="btn btn-ghost btn-sm px-2" aria-label={`Fiche de ${p.name}`} title="Fiche complète">
            <IconPencil size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

function PersonForm({
  persons,
  selfId,
  initial,
  onSave,
  onCancel,
  onDelete,
  deleteHint,
}: {
  persons: ContactPerson[];
  selfId?: string;
  initial: Partial<PersonDraft>;
  onSave: (d: PersonDraft) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  deleteHint?: string;
}) {
  const [d, setD] = useState<PersonDraft>({ name: "", title: "", email: "", phone: "", notes: "", parentId: null, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<PersonDraft>) => setD((prev) => ({ ...prev, ...p }));
  const managers = persons.filter((p) => p.id !== selfId && (!selfId || canReportTo(persons, selfId, p.id)));

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué.");
      setBusy(false);
    }
  }

  return (
    <form
      className="anim-fade my-1.5 rounded-xl border border-act/30 bg-surface-2/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.name.trim()) return setError("Indiquez au moins un nom.");
        void run(() => onSave(d));
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label="Nom">
          <input autoFocus value={d.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} className="input" />
        </Field>
        <Field label="Fonction">
          <input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Conseillère, recruteur, DRH…" className="input" />
        </Field>
        <Field label="Courriel">
          <input type="email" inputMode="email" value={d.email} onChange={(e) => set({ email: e.target.value })} className="input" />
        </Field>
        <Field label="Téléphone">
          <input type="tel" inputMode="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} className="input" />
        </Field>
        <Field label="Rattachée à" className="sm:col-span-2">
          <select value={d.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })} className="input">
            <option value="">Personne (en haut de l&apos;organigramme)</option>
            {managers.map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comment elle peut aider" className="sm:col-span-2">
          <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className="input" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {onDelete ? (
          <span className="flex items-center gap-2">
            <ConfirmButton label="Retirer la personne" onConfirm={() => void run(onDelete)}>
              <IconTrash size={13} /> Retirer
            </ConfirmButton>
            {deleteHint && <span className="text-[11.5px] text-faint">{deleteHint}</span>}
          </span>
        ) : (
          <span />
        )}
        <span className="flex flex-wrap items-center gap-2">
          {error && <span className="text-[12px] text-bad">{error}</span>}
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-sm btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn btn-sm btn-primary">
            <IconCheck size={14} /> {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </span>
      </div>
    </form>
  );
}
