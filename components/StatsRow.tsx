import { Meter, type Tone } from "./ui";

export interface Stat {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  pct?: number;
  markerPct?: number;
  markerLabel?: string;
  tone?: Tone;
}

export function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="card flex flex-col p-4">
          <p className="text-[12.5px] font-medium text-muted">{s.label}</p>
          <p className="mt-1.5 font-display text-[26px] leading-none font-bold tracking-tight">
            {s.value}
            {s.unit && <span className="ml-1 text-sm font-semibold text-muted">{s.unit}</span>}
          </p>
          {s.sub && <p className="mt-1.5 text-[12px] text-muted">{s.sub}</p>}
          {s.pct != null && (
            <div className="mt-auto pt-3.5">
              <Meter
                value={s.pct}
                tone={s.tone ?? "act"}
                label={s.label}
                markers={s.markerPct != null ? [{ pct: s.markerPct, label: s.markerLabel ?? "Repère" }] : []}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
