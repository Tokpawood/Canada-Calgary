import { parseD } from "@/lib/rules";

export interface NextStepInfo {
  title: string;
  due: string | null;
  daysLeft: number | null;
}

interface Props {
  phases: Array<{ phase: string; pct: number }>;
  overallPct: number;
  nextStep: NextStepInfo | null;
}

const P0 = { x: 40, y: 118 };
const P1 = { x: 500, y: -14 };
const P2 = { x: 960, y: 118 };
const PATH = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

function bezier(t: number) {
  const u = 1 - t;
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
  };
}

// Table d'abscisse curviligne : place l'avion et les jalons à une vraie fraction de la longueur du trajet.
const SAMPLES = (() => {
  const pts = Array.from({ length: 201 }, (_, i) => bezier(i / 200));
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, lens, total: lens[lens.length - 1] };
})();

function pointAt(fraction: number) {
  const target = Math.min(1, Math.max(0, fraction)) * SAMPLES.total;
  let i = SAMPLES.lens.findIndex((l) => l >= target);
  if (i <= 0) i = 1;
  const a = SAMPLES.pts[i - 1];
  const b = SAMPLES.pts[i];
  return { x: b.x, y: b.y, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

export function Hero({ phases, overallPct, nextStep }: Props) {
  const plane = pointAt(overallPct / 100);
  const waypoints = phases.map((p, i) => ({ ...p, ...pointAt((i + 1) / (phases.length + 1)) }));

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-night text-night-ink ring-1 ring-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
      />
      <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Abidjan → Calgary</p>
          <div className="mt-1 flex items-end gap-4">
            <p className="font-display text-[56px] leading-none font-extrabold tracking-tight">
              {overallPct}
              <span className="text-[28px] text-signal"> %</span>
            </p>
            <p className="pb-2 text-sm text-night-muted">du parcours effectué</p>
          </div>

          <svg viewBox="0 0 1000 140" className="mt-4 w-full" role="img" aria-label={`Trajet ABJ vers YYC, ${overallPct} % parcouru`}>
            <path d={PATH} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
            <path d={PATH} fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray={`${overallPct} 100`} />
            {waypoints.map((w) => (
              <g key={w.phase}>
                <title>{`${w.phase} — ${w.pct} %`}</title>
                <circle cx={w.x} cy={w.y} r="7" fill="var(--night)" stroke={w.pct === 100 ? "var(--signal)" : "rgba(255,255,255,0.35)"} strokeWidth="2" />
                {w.pct === 100 && <circle cx={w.x} cy={w.y} r="3" fill="var(--signal)" />}
              </g>
            ))}
            <circle cx={P0.x} cy={P0.y} r="5" fill="var(--signal)" />
            <circle cx={P2.x} cy={P2.y} r="5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <text x={P0.x} y={P0.y + 20} fill="var(--night-muted)" fontSize="15" fontFamily="var(--font-mono)" textAnchor="middle">ABJ</text>
            <text x={P2.x} y={P2.y + 20} fill="var(--night-muted)" fontSize="15" fontFamily="var(--font-mono)" textAnchor="middle">YYC</text>
            <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle + 45})`}>
              <circle r="15" fill="var(--signal)" opacity="0.18" />
              <path
                transform="translate(-12 -12)"
                d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
                fill="var(--signal)"
              />
            </g>
          </svg>

          <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
            {phases.map((p, i) => (
              <li key={p.phase} className="min-w-0">
                <div className="flex items-start gap-2">
                  <span className={`mono grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold ${p.pct === 100 ? "bg-signal text-[#1b1206]" : "bg-white/10 text-night-ink"}`}>
                    {i + 1}
                  </span>
                  <span className="line-clamp-2 pt-px text-[12.5px] leading-tight font-semibold" title={p.phase}>
                    {p.phase.replace(/^\d+\.\s*/, "")}
                  </span>
                </div>
                <div className="mt-1.5 ml-7 flex items-center gap-2">
                  <span className="h-1 flex-1 rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-signal" style={{ width: `${p.pct}%` }} />
                  </span>
                  <span className="mono text-[11px] text-night-muted">{p.pct}%</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {nextStep && (
          <div className="self-start rounded-2xl border border-white/10 bg-night-2/90 p-5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-signal uppercase">Prochaine étape</p>
            <p className="mt-2 font-display text-[19px] leading-snug font-bold">{nextStep.title}</p>
            {nextStep.due && (
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
                <div>
                  <p className="text-[11px] text-night-muted">Échéance</p>
                  <p className="mono text-sm">{fmtLong(nextStep.due)}</p>
                </div>
                {nextStep.daysLeft != null && (
                  <span
                    className={`mono rounded-lg px-2.5 py-1 text-[13px] font-semibold ${
                      nextStep.daysLeft < 0 ? "bg-[#f29a90] text-[#2a0b08]" : "bg-signal text-[#1b1206]"
                    }`}
                  >
                    {nextStep.daysLeft < 0 ? `${-nextStep.daysLeft} j de retard` : nextStep.daysLeft === 0 ? "aujourd'hui" : `J-${nextStep.daysLeft}`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function fmtLong(iso: string): string {
  const d = parseD(iso);
  return d ? d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) : iso;
}
