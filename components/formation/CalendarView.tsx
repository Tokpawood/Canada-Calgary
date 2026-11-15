"use client";

import { IELTS_DATE, PROGRAM_END, PROGRAM_START, TCF_DATE, addDays, dayPlan, weekday } from "@/lib/formation";
import { fmtDay } from "./shared";

const MONTHS = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];
const MILESTONES: Record<string, string> = {
  "2026-11-16": "Début du programme",
  "2026-12-14": "TCF phase 2 · achat du pack Gold",
  "2027-01-05": "Inscription au TCF",
  "2027-01-25": "TCF phase 3 · réserver l'IELTS",
  "2027-02-12": "Plus rien de nouveau (TCF)",
  [TCF_DATE]: "TCF Canada",
  "2027-02-16": "Début du programme IELTS",
  "2027-03-01": "IELTS phase 2 · intensif",
  "2027-03-25": "Plus rien de nouveau (IELTS)",
  [IELTS_DATE]: "IELTS General Training",
};

export function CalendarView({ today, done, onOpenDay }: { today: string; done: Set<string>; onOpenDay: (d: string) => void }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
        <Legend className="bg-ok" label="Journée complète" />
        <Legend className="bg-signal" label="Commencée" />
        <Legend className="border border-line bg-surface" label="Rien de coché" />
        <span className="flex items-center gap-1.5">
          <span className="mono rounded bg-opt-bg px-1 text-[10px] font-semibold text-opt">TCF</span>
          <span className="mono rounded bg-act px-1 text-[10px] font-semibold text-act-ink">IELTS</span>
          programme du jour
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-bad" /> examen officiel
        </span>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {MONTHS.map((m) => (
          <Month key={m} month={m} today={today} done={done} onOpenDay={onOpenDay} />
        ))}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} /> {label}
    </span>
  );
}

function Month({ month, today, done, onOpenDay }: { month: string; today: string; done: Set<string>; onOpenDay: (d: string) => void }) {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  const lead = weekday(first) - 1;

  return (
    <section className="card p-4 sm:p-5">
      <h3 className="mb-3 text-[15px] font-bold capitalize">{fmtDay(first, { month: "long", year: "numeric" })}</h3>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <span key={d} className="pb-1 text-[10.5px] font-semibold tracking-wide text-faint uppercase">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {days.map((d) => {
          const inside = d >= PROGRAM_START && d <= PROGRAM_END;
          const plan = inside ? dayPlan(d) : null;
          if (!plan) {
            return (
              <span key={d} className="grid aspect-square place-items-center rounded-lg text-[12px] text-faint/60">
                {Number(d.slice(8))}
              </span>
            );
          }
          const tot = plan.items.length;
          const c = plan.items.filter((i) => done.has(i.key)).length;
          const full = tot > 0 && c === tot;
          const started = c > 0 && !full;
          const exam = plan.kind === "examen";
          const milestone = MILESTONES[d];
          const late = d < today && !full;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onOpenDay(d)}
              title={`${fmtDay(d)} · ${c}/${tot}${milestone ? ` · ${milestone}` : ""}`}
              aria-label={`${fmtDay(d)}, ${c} sur ${tot} tâches faites${late && c === 0 ? ", en retard" : ""}${milestone ? `, ${milestone}` : ""}`}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[12.5px] font-semibold transition-transform hover:scale-[1.06] ${
                full ? "bg-ok text-white" : started ? "bg-signal text-black" : "border border-line bg-surface"
              } ${d === today ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""} ${exam ? "ring-2 ring-bad" : ""}`}
            >
              {Number(d.slice(8))}
              {plan.kind === "semaine" && (
                <span
                  className={`mono mt-0.5 rounded px-0.5 text-[8.5px] leading-[12px] font-bold ${
                    full || started ? "bg-black/15" : plan.program.id === "tcf" ? "bg-opt-bg text-opt" : "bg-act text-act-ink"
                  }`}
                >
                  {plan.program.id === "tcf" ? "TCF" : "IELTS"}
                </span>
              )}
              {exam && <span className="mt-0.5 text-[8.5px] font-bold text-bad">{plan.program.id === "tcf" ? "TCF" : "IELTS"}</span>}
              {milestone && !exam && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-bad" aria-hidden />}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-col gap-1 text-[12px] text-muted">
        {Object.entries(MILESTONES)
          .filter(([d]) => d.startsWith(month))
          .map(([d, label]) => (
            <li key={d} className="flex gap-2">
              <span className="mono w-12 shrink-0 font-semibold text-ink">{fmtDay(d, { day: "2-digit", month: "2-digit" })}</span>
              {label}
            </li>
          ))}
      </ul>
    </section>
  );
}
