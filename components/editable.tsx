"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconPencil } from "./icons";

export interface Editable<T> {
  editing: boolean;
  /** Valeur affichée : le brouillon en mode modification, sinon la valeur enregistrée. */
  current: T;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  /** Problème de saisie détecté dans le brouillon : « Enregistrer » reste grisé tant qu'il n'est pas corrigé. */
  invalid: string | null;
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
 * `validate` (facultatif) renvoie un message tant que le brouillon n'est pas enregistrable.
 * Raccourci : ⌘/Ctrl + Entrée enregistre la section en cours de modification.
 */
export function useEditable<T>(
  value: T,
  save: (draft: T) => Promise<void>,
  validate?: (draft: T) => string | null,
): Editable<T> {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = editing && !same(draft, value);
  const invalid = editing && validate ? validate(draft) : null;

  const commitRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.defaultPrevented)
        return;
      e.preventDefault();
      commitRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const api: Editable<T> = {
    editing,
    current: editing ? draft : value,
    dirty,
    saving,
    error,
    invalid,
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
      if (invalid) {
        setError(invalid);
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
  useEffect(() => {
    commitRef.current = () => void api.commit();
  });
  return api;
}

/** Boutons Modifier / Annuler / Enregistrer d'une section. */
export function EditBar<T>({
  edit,
  label = "Modifier",
  className = "",
}: {
  edit: Editable<T>;
  label?: string;
  className?: string;
}) {
  if (!edit.editing) {
    return (
      <button
        type="button"
        onClick={edit.start}
        className={`btn btn-sm btn-ghost ${className}`}
      >
        <IconPencil size={14} /> {label}
      </button>
    );
  }
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 ${className}`}
    >
      {(edit.invalid || edit.error) && (
        <span role="alert" className="text-[12px] text-bad">
          {edit.invalid ?? edit.error}
        </span>
      )}
      <button
        type="button"
        onClick={edit.cancel}
        disabled={edit.saving}
        className="btn btn-sm btn-ghost"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={() => void edit.commit()}
        disabled={edit.saving || !edit.dirty || !!edit.invalid}
        title={edit.invalid ?? "Enregistrer (⌘ + Entrée)"}
        className="btn btn-sm btn-primary"
      >
        <IconCheck size={14} />{" "}
        {edit.saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

/** Champs modifiés entre deux objets (comparaison superficielle). */
export function changedFields<T extends object>(
  before: T,
  after: T,
  keys?: Array<keyof T>,
): Partial<T> {
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
