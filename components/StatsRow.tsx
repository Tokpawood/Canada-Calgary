import type { ReactNode } from "react";
import { Meter, type Tone } from "./ui";
import { CountUp } from "./CountUp";

export interface Stat {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  pct?: number;
  markerPct?: number;
  markerLabel?: string;
  tone?: Tone;
  /** Couleur de la valeur quand elle signale quelque chose (ex. obligatoires manquants). */
  valueTone?: "bad" | "opt" | "ok";
  /** Jauge personnalisée à la place du Meter (ex. répartition par statut). */
  bar?: ReactNode;
}

const VALUE_TONE = { bad: "text-bad", opt: "text-opt", ok: "text-ok" } as const;

/** Bandeau de synthèse : une seule carte découpée en cases séparées par un filet. */
export function StatsRow({ stats, className = "my-5" }: { stats: Stat[]; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--shadow)] ${className}`}>
      <div className={`stagger grid gap-px ${stats.length >= 4 ? "grid-cols-2 xl:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col bg-surface px-4 py-3.5 sm:px-5">
            <p className="eyebrow">{s.label}</p>
            <p className={`mono mt-1.5 text-[24px] leading-none font-semibold tracking-tight ${s.valueTone ? VALUE_TONE[s.valueTone] : ""}`}>
              {/^\d{1,6}$/.test(s.value) ? <CountUp value={Number(s.value)} /> : s.value}
              {s.unit && <span className="ml-1 text-[13px] font-medium text-muted">{s.unit}</span>}
            </p>
            {s.sub && <p className="mt-1.5 truncate text-[12px] text-muted">{s.sub}</p>}
            {(s.bar || s.pct != null) && (
              <div className="mt-auto pt-3">
                {s.bar ?? (
                  <Meter
                    value={s.pct ?? 0}
                    tone={s.tone ?? "act"}
                    height={4}
                    label={s.label}
                    markers={s.markerPct != null ? [{ pct: s.markerPct, label: s.markerLabel ?? "Repère" }] : []}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
