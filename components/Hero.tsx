import type { ReactNode } from "react";
import { parseD } from "@/lib/rules";
import { IconAlert, IconArrowRight, IconCalendar, IconCheck } from "@/components/icons";

export interface NextStepInfo {
  title: string;
  due: string | null;
  daysLeft: number | null;
  phase: string;
  org: string;
  tasksDone: number;
  tasksTotal: number;
}

interface Props {
  phases: Array<{ phase: string; pct: number }>;
  overallPct: number;
  nextStep: NextStepInfo | null;
  done: number;
  counted: number;
  late: number;
  countdown: number | null;
  /** Index de la phase mise en avant sur le trajet (onglet ouvert), -1 sinon. */
  activePhase?: number;
  onPhase?: (index: number) => void;
  onOpenNext?: () => void;
  children?: ReactNode;
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
  // Arrondi : le serveur et le navigateur ne calculent pas tout à fait les mêmes décimales (erreur d'hydratation sinon).
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(b.x), y: r(b.y), angle: r((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) };
}

export function Hero({ phases, overallPct, nextStep, done, counted, late, countdown, activePhase = -1, onPhase, onOpenNext, children }: Props) {
  const plane = pointAt(overallPct / 100);
  const waypoints = phases.map((p, i) => ({ ...p, ...pointAt((i + 1) / (phases.length + 1)) }));

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-night text-night-ink ring-1 ring-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-signal opacity-[0.07] blur-3xl" />

      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">Abidjan → Calgary · Entrée express</p>
          <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex items-end gap-3">
              <p className="font-display text-[56px] leading-none font-extrabold tracking-tight">
                {overallPct}
                <span className="text-[28px] text-signal"> %</span>
              </p>
              <p className="pb-2 text-sm text-night-muted">du parcours effectué</p>
            </div>
            <ul className="flex flex-wrap gap-2 pb-1.5">
              <HeroPill icon={<IconCheck size={13} strokeWidth={2.6} />}>
                <span className="mono">{done}</span>/{counted} étapes faites
              </HeroPill>
              {late > 0 && (
                <HeroPill icon={<IconAlert size={13} />} tone="bad">
                  <span className="mono">{late}</span> en retard
                </HeroPill>
              )}
              {countdown != null && (
                <HeroPill icon={<IconCalendar size={13} />}>
                  Profil <span className="mono">{countdown >= 0 ? `J-${countdown}` : `+${-countdown} j`}</span>
                </HeroPill>
              )}
            </ul>
          </div>

          <svg viewBox="0 0 1000 140" className="mt-4 w-full overflow-visible" role="img" aria-label={`Trajet ABJ vers YYC, ${overallPct} % parcouru`}>
            <path d={PATH} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
            <path d={PATH} fill="none" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray={`${overallPct} 100`} />
            {waypoints.map((w, i) => {
              const on = i === activePhase;
              const full = w.pct === 100;
              return (
                <g
                  key={w.phase}
                  onClick={onPhase ? () => onPhase(i) : undefined}
                  className={onPhase ? "cursor-pointer" : undefined}
                  role={onPhase ? "button" : undefined}
                  aria-label={onPhase ? `Ouvrir la phase ${w.phase}` : undefined}
                >
                  <title>{`${w.phase} — ${w.pct} %`}</title>
                  <circle cx={w.x} cy={w.y} r="20" fill="transparent" />
                  {on && <circle cx={w.x} cy={w.y} r="13" fill="none" stroke="var(--night-ink)" strokeWidth="1.5" opacity="0.6" />}
                  <circle cx={w.x} cy={w.y} r="8" fill="var(--night)" stroke={full ? "var(--signal)" : on ? "var(--night-ink)" : "rgba(255,255,255,0.35)"} strokeWidth="2" />
                  {full ? (
                    <circle cx={w.x} cy={w.y} r="3.5" fill="var(--signal)" />
                  ) : (
                    <text x={w.x} y={w.y + 4} fill="var(--night-ink)" fontSize="11" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">
                      {i + 1}
                    </text>
                  )}
                  <text x={w.x} y={w.y - 18} fill={on ? "var(--night-ink)" : "var(--night-muted)"} fontSize="13" fontFamily="var(--font-mono)" textAnchor="middle">
                    {w.pct}%
                  </text>
                </g>
              );
            })}
            <circle cx={P0.x} cy={P0.y} r="5" fill="var(--signal)" />
            <circle cx={P2.x} cy={P2.y} r="5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <text x={P0.x} y={P0.y + 20} fill="var(--night-muted)" fontSize="15" fontFamily="var(--font-mono)" textAnchor="middle">ABJ</text>
            <text x={P2.x} y={P2.y + 20} fill="var(--night-muted)" fontSize="15" fontFamily="var(--font-mono)" textAnchor="middle">YYC</text>
            <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle + 45})`} pointerEvents="none">
              <circle r="15" fill="var(--signal)" opacity="0.18" />
              <path
                transform="translate(-12 -12)"
                d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
                fill="var(--signal)"
              />
            </g>
          </svg>
        </div>

        {nextStep ? (
          <div className="flex flex-col self-start rounded-2xl border border-white/10 bg-night-2/90 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-signal uppercase">Prochaine étape</p>
              <p className="truncate text-[11px] text-night-muted" title={nextStep.phase}>
                {nextStep.phase.replace(/^\d+\.\s*/, "")}
              </p>
            </div>
            <p className="mt-2 font-display text-[19px] leading-snug font-bold">{nextStep.title}</p>
            {nextStep.org && <p className="mt-1 text-[12.5px] text-night-muted">{nextStep.org}</p>}

            {nextStep.tasksTotal > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[11.5px] text-night-muted">
                  <span>Mini-étapes</span>
                  <span className="mono">
                    {nextStep.tasksDone}/{nextStep.tasksTotal}
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-signal" style={{ width: `${(nextStep.tasksDone / nextStep.tasksTotal) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
              <div>
                <p className="text-[11px] text-night-muted">Échéance</p>
                <p className="mono text-sm">{nextStep.due ? fmtLong(nextStep.due) : "non définie"}</p>
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
            {onOpenNext && (
              <button
                type="button"
                onClick={onOpenNext}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-night-ink px-3 py-2 text-[13px] font-semibold text-night transition-opacity hover:opacity-90"
              >
                Ouvrir l&apos;étape <IconArrowRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="self-start rounded-2xl border border-white/10 bg-night-2/90 p-5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-signal uppercase">Prochaine étape</p>
            <p className="mt-2 font-display text-[19px] font-bold">Toutes les étapes sont faites.</p>
          </div>
        )}
      </div>

      {children && <div className="relative border-t border-white/10 pt-2">{children}</div>}
    </section>
  );
}

function HeroPill({ icon, tone, children }: { icon: ReactNode; tone?: "bad"; children: ReactNode }) {
  return (
    <li
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        tone === "bad" ? "bg-[#f29a90]/15 text-[#f6b4ac]" : "bg-white/[0.08] text-night-ink"
      }`}
    >
      {icon}
      <span>{children}</span>
    </li>
  );
}

function fmtLong(iso: string): string {
  const d = parseD(iso);
  return d ? d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) : iso;
}
