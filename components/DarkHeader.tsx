"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CountUp } from "./CountUp";

/** En-tête sombre commun (Parcours, Profil, Budget, Épargne, Contacts) : contenu à gauche, indicateurs à droite, onglets en bas. */
export function DarkHeader({ children, aside, tabs }: { children: ReactNode; aside?: ReactNode; tabs?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[20px] bg-night text-night-ink ring-1 ring-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-signal opacity-[0.06] blur-3xl" />
      <div className="stagger relative flex flex-col gap-5 p-5 sm:p-7 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">{children}</div>
        {aside && <div className="shrink-0 xl:w-[360px]">{aside}</div>}
      </div>
      {tabs && <div className="relative border-t border-white/10 pt-2">{tabs}</div>}
    </section>
  );
}

/** Tuiles d'indicateurs sur fond sombre (2 colonnes). */
export function DarkTiles({ items }: { items: Array<{ label: string; value: ReactNode; unit?: string; sub?: ReactNode; pct?: number; tone?: "ok" | "signal" | "bad" }> }) {
  return (
    <div className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10">
      {items.map((t) => (
        <div key={t.label} className="min-w-0 bg-night-2 px-4 py-3.5">
          <p className="truncate text-[11px] font-semibold tracking-wide text-night-muted uppercase">{t.label}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className={`mono truncate text-[22px] leading-none font-semibold ${t.tone === "bad" ? "text-[#f6b4ac]" : ""}`}>
              {typeof t.value === "string" && /^\d{1,6}$/.test(t.value) ? <CountUp value={Number(t.value)} /> : t.value}
            </span>
            {t.unit && <span className="text-[12px] text-night-muted">{t.unit}</span>}
          </p>
          {t.pct != null && (
            <div className="mt-2.5 h-1 rounded-full bg-white/10" aria-hidden>
              <div
                className={`bar-grow h-full rounded-full ${t.tone === "ok" ? "bg-ok" : t.tone === "bad" ? "bg-bad" : "bg-signal"}`}
                style={{ width: `${Math.min(100, Math.max(0, t.pct))}%` }}
              />
            </div>
          )}
          {t.sub && <p className="mt-2 truncate text-[11.5px] text-night-muted">{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export interface HeaderTab<K extends string> {
  id: K;
  label: string;
  icon?: ReactNode;
  badge?: { text: string; tone?: "bad" | "ok" | "signal" | "plain" } | null;
  /** Point orange : modification en cours dans cet onglet. */
  dirty?: boolean;
}

const BADGE = { bad: "bg-bad text-white", ok: "bg-ok text-white", signal: "bg-signal text-black", plain: "bg-white/15 text-night-ink" } as const;

export function HeaderTabs<K extends string>({ tabs, active, onSelect, label }: { tabs: Array<HeaderTab<K>>; active: K; onSelect: (id: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mb-px flex gap-1 overflow-x-auto px-3 sm:px-5">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.id)}
            className={`flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
              on ? "bg-white/10 text-night-ink shadow-[inset_0_-2px_0_var(--signal)]" : "text-night-muted hover:bg-white/5 hover:text-night-ink"
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge && (
              <span className={`badge-in mono rounded-full px-1.5 text-[10.5px] leading-[18px] font-semibold ${on ? "bg-white/20 text-night-ink" : BADGE[t.badge.tone ?? "plain"]}`}>
                {t.badge.text}
              </span>
            )}
            {t.dirty && <span className="h-1.5 w-1.5 rounded-full bg-signal" title="Modification en cours" />}
          </button>
        );
      })}
    </div>
  );
}

/** Onglet actif synchronisé avec l'ancre de l'URL. */
export function useHashTab<K extends string>(ids: readonly K[], initial: K): [K, (id: K) => void] {
  const [tab, setTab] = useState<K>(initial);
  const key = ids.join("|");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as K;
      if (ids.includes(h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const select = (id: K) => {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  };
  return [tab, select];
}
