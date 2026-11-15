"use client";

import { useState } from "react";
import { PHASES, WEEKS, addDays, dayPlan, sendKey, weekKeys, weekday } from "@/lib/formation";
import { Meter } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";
import { CheckBox, LangTag, fmtDay, fmtRange } from "./shared";

export function WeeksView({ today, done, toggle, onOpenDay }: { today: string; done: Set<string>; toggle: (key: string, v: boolean) => void; onOpenDay: (d: string) => void }) {
  const current = WEEKS.find((w) => today >= w.from && today <= w.to)?.n ?? (today < WEEKS[0].from ? 1 : null);
  const [open, setOpen] = useState<Set<number>>(() => new Set(current ? [current] : []));

  return (
    <div className="flex flex-col gap-6">
      {PHASES.map((p) => {
        const weeks = WEEKS.filter((w) => w.from >= p.from && w.from <= p.to);
        return (
          <section key={p.n}>
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[17px] font-bold">
                Phase {p.n} · {p.name}
              </h2>
              <span className="text-[12.5px] text-muted">{fmtRange(p.from, p.to)}</span>
            </div>
            <p className="mb-3 text-[13px] text-muted">
              <strong className="text-ink">Objectif :</strong> {p.goal}. <strong className="text-ink">Ce qui change :</strong> {p.change}.
            </p>
            <div className="stagger flex flex-col gap-3">
              {weeks.map((w) => {
                const keys = weekKeys(w);
                const n = keys.filter((k) => done.has(k)).length;
                const isOpen = open.has(w.n);
                const isCurrent = w.n === current;
                return (
                  <article key={w.n} className={`card overflow-hidden ${isCurrent ? "ring-2 ring-signal" : ""}`}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((s) => {
                        const next = new Set(s);
                        if (next.has(w.n)) next.delete(w.n);
                        else next.add(w.n);
                        return next;
                      })}
                      className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-surface-2/60 sm:px-5"
                    >
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
                        <Meter value={(n / keys.length) * 100} tone={n === keys.length ? "ok" : "act"} className="flex-1" label={`Semaine ${w.n}`} />
                        <span className="mono w-9 text-right text-[11.5px] text-muted">{Math.round((n / keys.length) * 100)} %</span>
                      </span>
                      <IconChevronDown size={18} className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="grid grid-cols-1 gap-5 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-2">
                        <div className="flex flex-col gap-3 text-[13.5px]">
                          <Info label="Grammaire française" value={w.grammar} />
                          <Info label="Objectif IELTS" value={w.ielts} />
                          <Info label="Samedi" value={w.saturday.label} lang={w.saturday.lang} />
                          {w.note && <p className="rounded-lg bg-opt-bg px-3 py-2 text-[12.5px] text-opt">{w.note}</p>}
                          <div>
                            <p className="mb-1.5 text-[11.5px] font-semibold text-muted">Jours</p>
                            <div className="grid grid-cols-7 gap-1.5">
                              {Array.from({ length: 7 }, (_, i) => addDays(w.from, i)).map((d) => {
                                const plan = dayPlan(d);
                                const tot = plan?.items.length ?? 0;
                                const c = plan?.items.filter((it) => done.has(it.key)).length ?? 0;
                                const full = tot > 0 && c === tot;
                                return (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => onOpenDay(d)}
                                    title={`${fmtDay(d)} : ${c}/${tot}`}
                                    className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-[11px] transition-colors ${
                                      full ? "border-ok bg-ok-bg text-ok" : d === today ? "border-signal" : "border-line hover:bg-surface-2"
                                    }`}
                                  >
                                    <span className="font-semibold">{["L", "M", "M", "J", "V", "S", "D"][weekday(d) - 1]}</span>
                                    <span className="mono text-[10.5px] text-muted">
                                      {c}/{tot}
                                    </span>
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
                              const key = sendKey(w.n, i);
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
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Info({ label, value, lang }: { label: string; value: string; lang?: "tcf" | "ielts" | null }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-muted">{label}</p>
      <p className="flex items-center gap-2">
        {value}
        {lang && <LangTag lang={lang} />}
      </p>
    </div>
  );
}
