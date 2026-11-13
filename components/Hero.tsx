import { parseD } from "@/lib/rules";

export interface NextStepInfo {
  title: string;
  due: string | null;
  late: boolean;
}

interface Props {
  phases: Array<{ phase: string; pct: number }>;
  overallPct: number;
  nextStep: NextStepInfo | null;
}

export function Hero({ phases, overallPct, nextStep }: Props) {
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-night p-6 text-night-ink">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 font-mono font-semibold">
            <span className="text-4xl tracking-wide">ABJ</span>
            <span className="text-2xl text-signal">→</span>
            <span className="text-4xl tracking-wide">YYC</span>
          </div>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-night-muted">
            {overallPct}% du parcours effectué
          </p>
        </div>

        {nextStep && (
          <div className="min-w-[260px] max-w-[420px] flex-1 rounded-xl border border-white/10 bg-night-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-signal">Prochaine étape</p>
            <p className="mt-1.5 font-display text-lg font-bold leading-tight">{nextStep.title}</p>
            {nextStep.due && (
              <span
                className={`mt-2 inline-block rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                  nextStep.late ? "bg-[#f29a90] text-[#2a0b08]" : "bg-signal text-[#1b1206]"
                }`}
              >
                {fmtDue(nextStep.due)}
              </span>
            )}
          </div>
        )}
      </div>

      {phases.length > 0 && (
        <div className="mt-6 flex items-center gap-1">
          {phases.map((p, i) => (
            <div key={p.phase} className="flex flex-1 items-center gap-1">
              <div className="flex min-w-[64px] flex-col items-center gap-1 text-center">
                <span className={`text-[11px] ${p.pct === 100 ? "font-semibold text-night-ink" : "text-night-muted"}`}>
                  {p.phase.replace(/^(\d+)\..*/, "Phase $1")}
                </span>
                <span className="font-mono text-[11px] text-signal">{p.pct}%</span>
              </div>
              {i < phases.length - 1 && <div className="h-[2px] flex-1 bg-white/15" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDue(iso: string): string {
  const d = parseD(iso);
  if (!d) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
