"use client";

import type { ReactNode } from "react";
import { IconChevronDown, IconSearch, IconX } from "./icons";

/** Barre de filtres commune : recherche en haut, pastilles et menus dessous, compteur et réinitialisation à droite. */
export function FilterBar({
  query,
  onQuery,
  placeholder,
  searchLabel,
  actions,
  children,
  meta,
  onReset,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  searchLabel: string;
  /** Boutons à droite de la recherche (ex. ajout). */
  actions?: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  /** Affiché seulement quand un filtre est actif. */
  onReset?: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 pr-2">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 pl-4">
          <IconSearch size={17} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={searchLabel}
            className="min-w-0 flex-1 bg-transparent py-3 text-[14px] text-ink outline-none placeholder:text-faint"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label="Effacer la recherche" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-ink">
              <IconX size={15} />
            </button>
          )}
        </label>
        {actions}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-2/60 px-3 py-2.5">
        {children}
        {(meta || onReset) && (
          <span className="ml-auto flex items-center gap-3">
            {meta && <span className="text-[12px] text-muted">{meta}</span>}
            {onReset && (
              <button type="button" onClick={onReset} className="text-[12px] font-semibold text-act hover:underline">
                Réinitialiser
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  );
}

export function FilterDivider() {
  return <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />;
}

/** Pastille de filtre ; `alert` colore le compteur quand il signale un problème (ex. retards). */
export function FilterChip({
  active,
  onClick,
  label,
  count,
  icon,
  alert = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  icon?: ReactNode;
  alert?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
        active ? "border-act bg-act text-act-ink" : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
      }`}
    >
      {icon}
      {label}
      {count != null && (
        <span
          className={`mono rounded-full text-[11px] ${
            alert && count > 0 ? (active ? "bg-bad px-1.5 text-white" : "bg-bad-bg px-1.5 text-bad") : active ? "opacity-70" : "text-faint"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Menu déroulant en forme de pastille, mis en évidence quand une valeur autre que `allValue` est choisie. */
export function FilterSelect({
  value,
  onChange,
  allValue = "all",
  label,
  icon,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allValue?: string;
  label: string;
  icon?: ReactNode;
  options: Array<{ value: string; label: string }>;
}) {
  const on = value !== allValue;
  return (
    <label className={`relative flex items-center rounded-full border transition-colors ${on ? "border-act bg-act-soft" : "border-line bg-surface"}`}>
      {icon && <span className={`pointer-events-none absolute left-3 ${on ? "text-act" : "text-faint"}`}>{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`max-w-[230px] cursor-pointer appearance-none truncate rounded-full bg-transparent py-1 pr-8 text-[12.5px] font-semibold outline-none ${icon ? "pl-8" : "pl-3"} ${
          on ? "text-act" : "text-muted"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown size={14} className="pointer-events-none absolute right-2.5 text-faint" />
    </label>
  );
}
