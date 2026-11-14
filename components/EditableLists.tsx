"use client";

import { useState } from "react";
import { hostOf, safeUrl } from "@/lib/rules";
import { IconCheck, IconExternal, IconPlus, IconX } from "./icons";

interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export function Checklist({
  items,
  onToggle,
  onDelete,
  onAdd,
  placeholder,
  editable,
  toggleDisabled = false,
}: {
  items: CheckItem[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onAdd: (text: string) => void;
  placeholder: string;
  /** Ajout et suppression possibles seulement en mode modification. */
  editable: boolean;
  toggleDisabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  }

  return (
    <div>
      <ul className="flex flex-col">
        {items.map((it) => (
          <li key={it.id} className="group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={it.done}
              aria-label={it.text}
              disabled={toggleDisabled}
              onClick={() => onToggle(it.id, !it.done)}
              className={`mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors disabled:cursor-default disabled:opacity-60 ${
                it.done ? "border-ok bg-ok text-surface" : "border-line text-transparent enabled:hover:border-ok"
              }`}
            >
              <IconCheck size={11} strokeWidth={3.2} />
            </button>
            <span className={`flex-1 text-[14px] leading-snug ${it.done ? "text-faint line-through" : ""}`}>{it.text}</span>
            {editable && (
              <button
                type="button"
                onClick={() => onDelete(it.id)}
                aria-label={`Retirer « ${it.text} »`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-bad hover:bg-bad-bg"
              >
                <IconX size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-2 flex gap-2"
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input" />
        <button type="submit" disabled={!draft.trim()} className="btn btn-soft" aria-label="Ajouter">
          <IconPlus size={16} />
        </button>
      </form>}
      {!editable && items.length === 0 && <p className="text-[13px] text-faint">Aucun élément.</p>}
    </div>
  );
}

interface LinkItem {
  id: string;
  label: string;
  url: string;
}

export function LinkList({
  links,
  onAdd,
  onDelete,
  editable,
}: {
  links: LinkItem[];
  onAdd: (label: string, url: string) => void;
  onDelete: (id: string) => void;
  editable: boolean;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function submit() {
    const safe = safeUrl(url);
    if (!safe) {
      setError("Adresse invalide : elle doit commencer par https://");
      return;
    }
    onAdd(label.trim() || safe, safe);
    setLabel("");
    setUrl("");
    setError(null);
    setOpen(false);
  }

  return (
    <div>
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {links.map((l) => (
            <li key={l.id} className="group flex items-center gap-2 rounded-xl border border-line px-3 py-2 hover:border-act/40">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5">
                <IconExternal size={15} className="shrink-0 text-act" />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{l.label}</span>
                  <span className="mono block truncate text-[11px] text-faint">{hostOf(l.url)}</span>
                </span>
              </a>
              {editable && (
                <button
                  type="button"
                  onClick={() => onDelete(l.id)}
                  aria-label={`Retirer le lien « ${l.label} »`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-bad hover:bg-bad-bg"
                >
                  <IconX size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!editable ? (
        links.length === 0 && <p className="text-[13px] text-faint">Aucun lien.</p>
      ) : open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-2 flex flex-col gap-2 rounded-xl bg-surface-2 p-3"
        >
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (facultatif)" aria-label="Libellé du lien" className="input" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Adresse du lien" inputMode="url" className="input mono" />
          {error && <p className="text-[12px] text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-sm btn-ghost">
              Annuler
            </button>
            <button type="submit" disabled={!url.trim()} className="btn btn-sm btn-primary">
              Ajouter le lien
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-sm btn-ghost mt-2">
          <IconPlus size={14} />
          Ajouter un lien
        </button>
      )}
    </div>
  );
}
