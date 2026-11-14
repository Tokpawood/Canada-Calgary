"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconPencil } from "./icons";

export interface Editable<T> {
  editing: boolean;
  /** Valeur affichée : le brouillon en mode modification, sinon la valeur enregistrée. */
  current: T;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  set: (patch: Partial<T>) => void;
  update: (fn: (draft: T) => T) => void;
  start: () => void;
  cancel: () => void;
  commit: () => Promise<void>;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Lecture seule par défaut : « Modifier » ouvre un brouillon, « Enregistrer » l'écrit en base, « Annuler » l'abandonne.
 * `save` doit lever une erreur si l'écriture échoue : le brouillon reste alors ouvert.
 */
export function useEditable<T>(value: T, save: (draft: T) => Promise<void>): Editable<T> {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = editing && !same(draft, value);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return {
    editing,
    current: editing ? draft : value,
    dirty,
    saving,
    error,
    set: (patch) => setDraft((d) => ({ ...d, ...patch })),
    update: (fn) => setDraft((d) => fn(d)),
    start: () => {
      setDraft(value);
      setError(null);
      setEditing(true);
    },
    cancel: () => {
      setEditing(false);
      setError(null);
    },
    commit: async () => {
      if (!dirty) {
        setEditing(false);
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await save(draft);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "L'enregistrement a échoué.");
      } finally {
        setSaving(false);
      }
    },
  };
}

/** Boutons Modifier / Annuler / Enregistrer d'une section. */
export function EditBar<T>({ edit, label = "Modifier", className = "" }: { edit: Editable<T>; label?: string; className?: string }) {
  if (!edit.editing) {
    return (
      <button type="button" onClick={edit.start} className={`btn btn-sm btn-ghost ${className}`}>
        <IconPencil size={14} /> {label}
      </button>
    );
  }
  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      {edit.error && <span className="text-[12px] text-bad">{edit.error}</span>}
      <button type="button" onClick={edit.cancel} disabled={edit.saving} className="btn btn-sm btn-ghost">
        Annuler
      </button>
      <button type="button" onClick={() => void edit.commit()} disabled={edit.saving || !edit.dirty} className="btn btn-sm btn-primary">
        <IconCheck size={14} /> {edit.saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

/** Champs modifiés entre deux objets (comparaison superficielle). */
export function changedFields<T extends object>(before: T, after: T, keys?: Array<keyof T>): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys ?? (Object.keys(after) as Array<keyof T>)) {
    if (!same(before[k], after[k])) out[k] = after[k];
  }
  return out;
}

let tmpCounter = 0;
/** Identifiant provisoire d'un élément ajouté au brouillon, remplacé à l'enregistrement. */
export function tmpId(): string {
  tmpCounter += 1;
  return `tmp-${Date.now().toString(36)}-${tmpCounter}`;
}

export const isTmp = (id: string) => id.startsWith("tmp-");
