export interface Stat {
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  markerPct?: number;
}

export function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <p className="text-xs font-medium text-muted">{s.label}</p>
          <p className="mt-1 font-display text-2xl font-bold">{s.value}</p>
          {s.sub && <p className="mt-1 text-[12.5px] text-muted">{s.sub}</p>}
          {s.pct != null && (
            <div className="relative mt-2.5 h-1.5 rounded-full border border-line bg-surface-2">
              <span
                className="block h-full rounded-full bg-act transition-[width]"
                style={{ width: `${Math.min(100, Math.max(0, s.pct))}%` }}
              />
              {s.markerPct != null && (
                <i
                  className="absolute -top-1 -bottom-1 w-[2px] rounded bg-bad"
                  style={{ left: `${Math.min(100, Math.max(0, s.markerPct))}%` }}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
