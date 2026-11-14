"use client";

import { useState } from "react";
import { parseD } from "@/lib/rules";
import { IconCheck, IconCopy } from "@/components/icons";

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  type?: "text" | "date" | "tel" | "email";
  placeholder?: string;
  hint?: string;
}

function display(type: FieldDef<string>["type"], value: string) {
  if (type !== "date") return value;
  const d = parseD(value);
  return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : value;
}

/**
 * Liste label / valeur à lignes fines, comme un formulaire officiel.
 * En lecture, chaque valeur se copie d'un clic (pratique pour remplir les formulaires en ligne) ;
 * en modification, la valeur devient un champ de saisie.
 */
export function FieldGrid<K extends string>({
  fields,
  values,
  editing,
  onChange,
}: {
  fields: Array<FieldDef<K>>;
  values: Record<K, string>;
  editing: boolean;
  onChange: (key: K, value: string) => void;
}) {
  return (
    <dl className="m-0 divide-y divide-line">
      {fields.map((f) => {
        const value = values[f.key] ?? "";
        return (
          <div key={f.key} className="group grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center sm:gap-4">
            <dt className="text-[12.5px] font-medium text-muted">{f.label}</dt>
            <dd className="m-0 min-w-0">
              {editing ? (
                <>
                  <input
                    type={f.type ?? "text"}
                    value={value}
                    placeholder={f.placeholder}
                    aria-label={f.label}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    className="input"
                  />
                  {f.hint && <span className="mt-1 block text-[11.5px] text-faint">{f.hint}</span>}
                </>
              ) : value ? (
                <div className="flex min-w-0 items-center gap-2">
                  <ReadValue type={f.type} value={value} />
                  <CopyButton text={f.type === "date" ? value : value} label={f.label} />
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-opt-bg px-2 py-0.5 text-[12px] font-semibold text-opt">À compléter</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ReadValue({ type, value }: { type: FieldDef<string>["type"]; value: string }) {
  const cls = "min-w-0 text-[14.5px] leading-snug font-semibold break-words";
  if (type === "email")
    return (
      <a href={`mailto:${value}`} className={`${cls} text-act hover:underline`}>
        {value}
      </a>
    );
  if (type === "tel")
    return (
      <a href={`tel:${value.replace(/[^\d+]/g, "")}`} className={`${cls} mono text-act hover:underline`}>
        {value}
      </a>
    );
  return <span className={cls}>{display(type, value)}</span>;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* presse-papiers indisponible : on ne fait rien */
        }
      }}
      aria-label={`Copier : ${label}`}
      title={done ? "Copié" : "Copier"}
      className={`no-print grid h-7 w-7 shrink-0 place-items-center rounded-md transition-opacity ${
        done ? "text-ok opacity-100" : "text-faint hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
      }`}
    >
      {done ? <IconCheck size={14} strokeWidth={2.6} /> : <IconCopy size={14} />}
    </button>
  );
}
