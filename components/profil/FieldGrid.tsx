"use client";

import { parseD } from "@/lib/rules";

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  type?: "text" | "date" | "tel" | "email";
  placeholder?: string;
  wide?: boolean;
  hint?: string;
}

function display(type: FieldDef<string>["type"], value: string) {
  if (type !== "date") return value;
  const d = parseD(value);
  return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : value;
}

/** Lecture : fiche label / valeur. Modification : champs de saisie à la même place. */
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
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {fields.map((f) => {
        const value = values[f.key] ?? "";
        return (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
            <dt className="field-label">{f.label}</dt>
            <dd className="m-0">
              {editing ? (
                <input
                  type={f.type ?? "text"}
                  value={value}
                  placeholder={f.placeholder}
                  aria-label={f.label}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className="input"
                />
              ) : value ? (
                <ReadValue type={f.type} value={value} />
              ) : (
                <span className="text-[14px] text-faint italic">À compléter</span>
              )}
              {editing && f.hint && <span className="mt-1 block text-[11.5px] text-faint">{f.hint}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ReadValue({ type, value }: { type: FieldDef<string>["type"]; value: string }) {
  const cls = "block text-[14.5px] leading-snug font-medium break-words";
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
