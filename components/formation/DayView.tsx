"use client";

import {
  PROGRAM_END,
  PROGRAM_START,
  addDays,
  dayPlan,
  sendKey,
  type DayItem,
  type Week,
} from "@/lib/formation";
import { Meter } from "@/components/ui";
import {
  IconChevronLeft,
  IconChevronRight,
  IconInfo,
} from "@/components/icons";
import { CheckBox, LangTag, fmtDay, minutesLabel } from "./shared";
import { exercicesFor, intitule } from "@/lib/sujets";
import { TaskDrawer } from "./TaskDrawer";

const GROUP_LABEL: Record<DayItem["group"], string> = {
  jalon: "À faire aujourd'hui",
  examen: "Examen",
  matin: "Matin",
  trajet: "Trajets",
  midi: "Pause déjeuner",
  soir: "Soir",
  weekend: "Programme du jour",
};

export function DayView({
  date,
  today,
  onDate,
  done,
  toggle,
  openKey,
  onOpen,
  canEdit,
  onTool,
  toolDone,
}: {
  /** Tâche déjà faite dans l'application. */
  toolDone?: (it: DayItem) => boolean;
  /** Ouvre l'outil de l'application qui sert à faire la tâche (test TCF Canada, exercices du jour). */
  onTool?: (tool: NonNullable<DayItem["tool"]>) => void;
  date: string;
  today: string;
  onDate: (d: string) => void;
  done: Set<string>;
  toggle: (key: string, v: boolean) => void;
  /** Tâche dont le tiroir est ouvert. */
  openKey: string | null;
  onOpen: (key: string | null) => void;
  canEdit: boolean;
}) {
  const plan = dayPlan(date);
  if (!plan) return null;
  const total = plan.items.length;
  const count = plan.items.filter((i) => done.has(i.key)).length;
  const minutes = plan.items.reduce((s, i) => s + (i.minutes ?? 0), 0);
  const isToday = date === today;
  const past = date < today;

  const groups: Array<[DayItem["group"], DayItem[]]> = [];
  for (const it of plan.items) {
    const last = groups[groups.length - 1];
    if (last && last[0] === it.group) last[1].push(it);
    else groups.push([it.group, [it]]);
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm h-9 w-9 p-0"
              aria-label="Jour précédent"
              disabled={date <= PROGRAM_START}
              onClick={() => onDate(addDays(date, -1))}
            >
              <IconChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm h-9 w-9 p-0"
              aria-label="Jour suivant"
              disabled={date >= PROGRAM_END}
              onClick={() => onDate(addDays(date, 1))}
            >
              <IconChevronRight size={17} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[17px] font-bold capitalize">
              {fmtDay(date)}
              <LangTag lang={plan.program.id} />
              {isToday && (
                <span className="rounded-full bg-signal px-2 py-px text-[11px] font-bold text-black normal-case">
                  Aujourd&apos;hui
                </span>
              )}
            </p>
            <p className="text-[12.5px] text-muted">
              {plan.title}
              {plan.week && ` · ${plan.program.name}, semaine ${plan.week.n}`}
              {minutes > 0 && ` · ${minutesLabel(minutes)} au total`}
            </p>
          </div>
          {!isToday && today >= PROGRAM_START && today <= PROGRAM_END && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDate(today)}
            >
              Revenir à aujourd&apos;hui
            </button>
          )}
        </div>

        <div className="px-4 pt-3 sm:px-5">
          <div className="flex items-center gap-3">
            <Meter
              value={total ? (count / total) * 100 : 0}
              tone={count === total ? "ok" : "act"}
              className="flex-1"
              label="Avancement du jour"
            />
            <span className="mono text-[12.5px] font-semibold">
              {count}/{total}
            </span>
          </div>
          {canEdit && past && count < total && (
            <p className="mt-2 text-[12.5px] text-opt">
              Jour passé : cochez ce qui a été fait pour garder un suivi juste.
            </p>
          )}
        </div>

        <div className="stagger flex flex-col pb-2">
          {groups.map(([g, items], gi) => (
            <div key={`${g}-${gi}`} className="px-2 pt-3 sm:px-3">
              <p className="eyebrow px-2 pb-1">{GROUP_LABEL[g]}</p>
              <ul>
                {items.map((it) => {
                  const on = done.has(it.key);
                  const exos = exercicesFor(date, it);
                  return (
                    <li key={it.key}>
                      <div className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                        <span className="pt-0.5">
                          <CheckBox
                            checked={on}
                            onChange={(v) => toggle(it.key, v)}
                            label={it.label}
                            disabled={!canEdit}
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpen(it.key)}
                          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                        >
                          <span className="mono w-[92px] shrink-0 pt-1 text-[12px] text-muted sm:w-[104px]">
                            {it.time}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[14.5px] leading-snug font-medium ${on ? "text-faint line-through" : ""}`}
                            >
                              {it.label}
                            </span>
                            {it.detail && (
                              <span className="mt-0.5 block text-[12.5px] text-muted">
                                {it.detail}
                              </span>
                            )}
                            {exos.map((e) => (
                              <span
                                key={e.titre}
                                className="mt-1 line-clamp-2 block text-[13px] leading-snug"
                              >
                                <span className="font-semibold">
                                  {exos.length > 1
                                    ? `Tâche ${e.kind.slice(-1)} : `
                                    : e.kind === "gram"
                                      ? "Exercice : "
                                      : "Sujet : "}
                                </span>
                                {intitule(e)}
                              </span>
                            ))}
                            <span className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-semibold text-muted">
                              {exos.length
                                ? "Sujet, consigne et méthodologie"
                                : "Méthode et ressources"}
                              <IconChevronRight size={13} />
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                            {it.lang && <LangTag lang={it.lang} />}
                            {it.minutes != null && (
                              <span className="mono text-[11px] text-faint">
                                {minutesLabel(it.minutes)}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>
                      {it.tool && date === today && toolDone?.(it) ? (
                        <p className="mb-1 ml-[44px] inline-flex items-center gap-1 text-[12.5px] font-semibold text-ok sm:ml-[48px]">
                          ✓ Fait dans l&apos;application
                          {!on && canEdit ? " : pensez à cocher la tâche" : ""}
                        </p>
                      ) : (
                        it.tool &&
                        onTool &&
                        date >= today && (
                          <button
                            type="button"
                            onClick={() => onTool(it.tool!)}
                            className="btn btn-ghost mb-1 ml-[44px] min-h-9 px-3 text-[12.5px] font-semibold sm:ml-[48px]"
                          >
                            {it.tool === "tcf"
                              ? "Ouvrir le test TCF Canada"
                              : "Ouvrir les exercices du jour"}
                            <IconChevronRight size={14} />
                          </button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {plan.tip && (
          <p className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted sm:mx-5">
            <IconInfo size={15} className="mt-px shrink-0" />
            {plan.tip}
          </p>
        )}
      </section>

      {plan.week && (
        <WeekAside
          week={plan.week}
          done={done}
          toggle={toggle}
          canEdit={canEdit}
        />
      )}
      {openKey && plan.items.some((i) => i.key === openKey) && (
        <TaskDrawer
          plan={plan}
          itemKey={openKey}
          done={done}
          toggle={toggle}
          onSelect={onOpen}
          onClose={() => onOpen(null)}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function WeekAside({
  week,
  done,
  toggle,
  canEdit,
}: {
  week: Week;
  done: Set<string>;
  toggle: (key: string, v: boolean) => void;
  canEdit: boolean;
}) {
  const sent = week.sends.filter((_, i) => done.has(sendKey(week, i))).length;
  return (
    <div className="flex flex-col gap-5 self-start">
      <section className="card p-5">
        <p className="eyebrow">
          {week.prog === "tcf" ? "TCF" : "IELTS"} · semaine {week.n}
        </p>
        <dl className="mt-3 flex flex-col gap-3 text-[13.5px]">
          <div>
            <dt className="text-[11.5px] font-semibold text-muted">
              Thème de vocabulaire
            </dt>
            <dd className="font-semibold">{week.theme}</dd>
          </div>
          {week.grammar && (
            <div>
              <dt className="text-[11.5px] font-semibold text-muted">
                Grammaire
              </dt>
              <dd>{week.grammar}</dd>
            </div>
          )}
          {week.focus.map((f) => (
            <div key={f.label}>
              <dt className="text-[11.5px] font-semibold text-muted">
                {f.label}
              </dt>
              <dd>{f.value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[11.5px] font-semibold text-muted">
              Objectif de la semaine
            </dt>
            <dd>{week.goal}</dd>
          </div>
        </dl>
        {week.note && (
          <p className="mt-3 rounded-lg bg-opt-bg px-3 py-2 text-[12.5px] text-opt">
            {week.note}
          </p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold">Envois à Claude</p>
          <span className="mono text-[12px] text-muted">
            {sent}/{week.sends.length}
          </span>
        </div>
        <ul className="mt-2 flex flex-col">
          {week.sends.map((s, i) => {
            const key = sendKey(week, i);
            const on = done.has(key);
            return (
              <li key={key}>
                <label
                  className={`-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2 ${canEdit ? "cursor-pointer hover:bg-surface-2" : ""}`}
                >
                  <CheckBox
                    checked={on}
                    onChange={(v) => toggle(key, v)}
                    label={s.label}
                    size={20}
                    disabled={!canEdit}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] leading-snug font-medium ${on ? "text-faint line-through" : ""}`}
                    >
                      {s.label}
                    </span>
                    {s.subject && (
                      <span className="block text-[12px] text-muted">
                        {s.subject}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
