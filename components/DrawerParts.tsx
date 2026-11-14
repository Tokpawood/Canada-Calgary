"use client";

import type { ReactNode } from "react";

/** Titre de l'en-tête sombre : texte en lecture, champ en modification. */
export function DrawerTitle({ value, editing, onChange, label }: { value: string; editing: boolean; onChange: (v: string) => void; label: string }) {
  if (!editing) return <h2 className="mt-1.5 font-display text-[22px] leading-snug font-bold break-words">{value || "Sans titre"}</h2>;
  return (
    <textarea
      value={value}
      rows={2}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="mt-1.5 w-full resize-none rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-display text-[20px] leading-snug font-bold text-night-ink outline-none focus:border-signal"
    />
  );
}

/** Choix de statut sur fond sombre : seul le statut courant est visible en lecture. */
export function DarkStatusPicker<S extends string>({
  options,
  value,
  editing,
  onChange,
  dotClass,
  label,
}: {
  options: S[];
  value: S;
  editing: boolean;
  onChange: (s: S) => void;
  dotClass: (s: S) => string;
  label: string;
}) {
  if (!editing)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass(value)}`} />
        {value}
      </span>
    );
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-black/40 p-1">
      {options.map((s) => {
        const on = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
              on ? "bg-night-ink text-night" : "text-night-muted hover:bg-white/10 hover:text-night-ink"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass(s)}`} />
            {s}
          </button>
        );
      })}
    </div>
  );
}

/** Chiffres clés de l'en-tête sombre. */
export function DrawerFacts({ items }: { items: Array<{ label: string; value: ReactNode; tone?: "bad" | "ok" }> }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-3">
      {items.map((f) => (
        <div key={f.label} className="min-w-0 bg-night-2 px-3 py-2.5">
          <dt className="truncate text-[10.5px] font-semibold tracking-wide text-night-muted uppercase">{f.label}</dt>
          <dd className={`mono m-0 mt-0.5 truncate text-[13.5px] font-semibold ${f.tone === "bad" ? "text-[#f6b4ac]" : f.tone === "ok" ? "text-[#8fd6a8]" : ""}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Bloc de contenu d'un onglet de tiroir. */
export function DrawerCard({ title, sub, aside, children, className = "" }: { title: string; sub?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-bold">{title}</h3>
          {sub && <p className="text-[12px] text-muted">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Rangée label / valeur en lecture (les champs vides restent discrets). */
export function ReadRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-t border-line py-2.5 first:border-t-0">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="m-0 text-[13.5px] font-semibold break-words whitespace-pre-line">{value || <span className="font-normal text-faint">—</span>}</dd>
    </div>
  );
}
