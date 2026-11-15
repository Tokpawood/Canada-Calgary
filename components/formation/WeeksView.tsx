"use client";

import { useState } from "react";
import { PROGRAMS, addDays, dayPlan, daysBetween, sendKey, weekKeys, weekday, type Week } from "@/lib/formation";
import { Meter } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";
import { CheckBox, LangTag, fmtDay, fmtRange } from "./shared";

const wid = (w: Week) => `${w.prog}${w.n}`;

export function WeeksView({ today, done, toggle, onOpenDay }: { today: string; done: Set<string>; toggle: (key: string, v: boolean) => void; onOpenDay: (d: string) => void }) {
  const allWeeks = PROGRAMS.flatMap((p) => p.weeks);
  const current = allWeeks.find((w) => today >= w.from && today <= w.to) ?? (today < allWeeks[0].from ? allWeeks[0] : null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(current ? [wid(current)] : []));

  return (
    <div className="flex flex-col gap-8">
      {PROGRAMS.map((prog) => (
        <section key={prog.id}>
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display text-[22px] font-extrabold">{prog.name}</h2>
            <LangTag lang={prog.id} />
            <span className="text-[13px] text-muted">
              {fmtRange(prog.from, prog.to)} · {prog.target}
            </span>
          </div>
          <div className="flex flex-col gap-6">
            {prog.phases.map((p) => {
              const weeks = prog.weeks.filter((w) => w.from >= p.from && w.from <= p.to);
              return (
                <div key={p.n}>
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3">
                    <h3 className="text-[16px] font-bold">
                      Phase {p.n} · {p.name}
                    </h3>
                    <span className="text-[12.5px] text-muted">{fmtRange(p.from, p.to)}</span>
                  </div>
                  <p className="mb-3 text-[13px] text-muted">
                    <strong className="text-ink">Objectif :</strong> {p.goal}.{p.change && <> <strong className="text-ink">Ce qui change :</strong> {p.change}.</>}
                  </p>
                  <div className="stagger flex flex-col gap-3">
                    {weeks.map((w) => (
                      <WeekCard
                        key={wid(w)}
                        week={w}
                        today={today}
                        done={done}
                        toggle={toggle}
                        onOpenDay={onOpenDay}
                        isCurrent={current ? wid(current) === wid(w) : false}
                        isOpen={open.has(wid(w))}
                        onToggleOpen={() =>
                          setOpen((s) => {
                            const next = new Set(s);
                            if (next.has(wid(w))) next.delete(wid(w));
                            else next.add(wid(w));
                            return next;
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function WeekCard({
  week: w,
  today,
  done,
  toggle,
  onOpenDay,
  isCurrent,
  isOpen,
  onToggleOpen,
}: {
  week: Week;
  today: string;
  done: Set<string>;
  toggle: (key: string, v: boolean) => void;
  onOpenDay: (d: string) => void;
  isCurrent: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
}) {
  const keys = weekKeys(w);
  const n = keys.filter((k) => done.has(k)).length;
  const pct = keys.length ? (n / keys.length) * 100 : 0;
  const days = Array.from({ length: daysBetween(w.from, w.to) + 1 }, (_, i) => addDays(w.from, i));

  return (
    <article className={`card overflow-hidden ${isCurrent ? "ring-2 ring-signal" : ""}`}>
      <button type="button" aria-expanded={isOpen} onClick={onToggleOpen} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-surface-2/60 sm:px-5">
        <span className={`mono grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold ${isCurrent ? "bg-signal text-black" : "bg-surface-2"}`}>{w.n}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
            {w.theme}
            {isCurrent && <span className="rounded-full bg-signal-soft px-2 py-px text-[11px] font-bold text-opt">Cette semaine</span>}
          </span>
          <span className="block truncate text-[12.5px] text-muted">
            {fmtRange(w.from, w.to)} · {w.goal}
          </span>
        </span>
        <span className="hidden w-[150px] shrink-0 items-center gap-2 sm:flex">
          <Meter value={pct} tone={n === keys.length ? "ok" : "act"} className="flex-1" label={`Semaine ${w.n}`} />
          <span className="mono w-9 text-right text-[11.5px] text-muted">{Math.round(pct)} %</span>
        </span>
        <IconChevronDown size={18} className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 gap-5 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3 text-[13.5px]">
            {w.grammar && <Info label="Grammaire" value={w.grammar} />}
            {w.focus.map((f) => (
              <Info key={f.label} label={f.label} value={f.value} />
            ))}
            {w.saturday && <Info label={w.saturday.mock ? "Samedi · examen blanc" : "Samedi"} value={w.saturday.label} />}
            {w.note && <p className="rounded-lg bg-opt-bg px-3 py-2 text-[12.5px] text-opt">{w.note}</p>}
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold text-muted">Jours</p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: weekday(w.from) - 1 }, (_, i) => (
                  <span key={`v${i}`} />
                ))}
                {days.map((d) => {
                  const plan = dayPlan(d);
                  const tot = plan?.items.length ?? 0;
                  const c = plan?.items.filter((it) => done.has(it.key)).length ?? 0;
                  const full = tot > 0 && c === tot;
                  const exam = plan?.kind === "examen";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onOpenDay(d)}
                      title={`${fmtDay(d)} : ${c}/${tot}`}
                      className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-[11px] transition-colors ${
                        full ? "border-ok bg-ok-bg text-ok" : exam ? "border-bad" : d === today ? "border-signal" : "border-line hover:bg-surface-2"
                      }`}
                    >
                      <span className="font-semibold">
                        {["L", "M", "M", "J", "V", "S", "D"][weekday(d) - 1]} {Number(d.slice(8))}
                      </span>
                      <span className="mono text-[10.5px] text-muted">{exam ? "examen" : `${c}/${tot}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold text-muted">Envois à Claude</p>
            <ul className="mt-1 flex flex-col">
              {w.sends.map((s, i) => {
                const key = sendKey(w, i);
                const on = done.has(key);
                return (
                  <li key={key}>
                    <label className="-mx-2 flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <CheckBox checked={on} onChange={(v) => toggle(key, v)} label={s.label} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13.5px] leading-snug font-medium ${on ? "text-faint line-through" : ""}`}>{s.label}</span>
                        {s.subject && <span className="block text-[12px] text-muted">{s.subject}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-muted">{label}</p>
      <p>{value}</p>
    </div>
  );
}
