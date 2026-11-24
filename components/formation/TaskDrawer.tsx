"use client";

import { Drawer } from "@/components/ui";
import { DrawerCard, DrawerFacts } from "@/components/DrawerParts";
import { IconCheck, IconChevronLeft, IconChevronRight, IconExternal, IconInfo } from "@/components/icons";
import { guideFor } from "@/lib/formationGuide";
import type { DayPlan } from "@/lib/formation";
import { exercicesFor } from "@/lib/sujets";
import { ExerciceCard } from "./ExerciceCard";
import { LangTag, fmtDay, minutesLabel } from "./shared";

const NAV_BTN =
  "grid h-8 w-8 place-items-center rounded-lg text-night-muted hover:bg-white/10 hover:text-night-ink disabled:opacity-30 disabled:hover:bg-transparent";

export function TaskDrawer({
  plan,
  itemKey,
  done,
  toggle,
  onSelect,
  onClose,
  canEdit,
}: {
  plan: DayPlan;
  itemKey: string;
  done: Set<string>;
  toggle: (key: string, v: boolean) => void;
  onSelect: (key: string) => void;
  onClose: () => void;
  canEdit: boolean;
}) {
  const idx = plan.items.findIndex((i) => i.key === itemKey);
  const item = plan.items[idx];
  if (!item) return null;
  const guide = guideFor(item.topic);
  const on = done.has(item.key);
  const prev = plan.items[idx - 1];
  const next = plan.items[idx + 1];
  const week = plan.week;
  // La méthodologie du sujet remplace la méthode générale de la tâche.
  const withSubject = exercicesFor(plan.date, item).length > 0;

  function validate() {
    toggle(item.key, !on);
    // Une fois validée, on passe directement à la tâche suivante non faite.
    if (!on) {
      const after = plan.items.slice(idx + 1).find((i) => !done.has(i.key));
      if (after) onSelect(after.key);
    }
  }

  return (
    <Drawer
      label={`Tâche : ${item.label}`}
      onClose={onClose}
      topActions={
        <>
          <button
            type="button"
            className={NAV_BTN}
            disabled={!prev}
            onClick={() => prev && onSelect(prev.key)}
            aria-label="Tâche précédente"
            title="Tâche précédente"
          >
            <IconChevronLeft size={17} />
          </button>
          <button
            type="button"
            className={NAV_BTN}
            disabled={!next}
            onClick={() => next && onSelect(next.key)}
            aria-label="Tâche suivante"
            title="Tâche suivante"
          >
            <IconChevronRight size={17} />
          </button>
        </>
      }
      header={
        <>
          <p className="pr-28 text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase first-letter:uppercase">
            {fmtDay(plan.date)} · tâche {idx + 1} / {plan.items.length}
          </p>
          <h2 className="mt-1.5 font-display text-[22px] leading-tight font-bold">{item.label}</h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {item.lang && <LangTag lang={item.lang} />}
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${on ? "bg-[#8fd6a8] text-[#0b2414]" : "bg-white/10"}`}>
              {on ? "Fait" : "À faire"}
            </span>
            {guide && <span className="text-[12.5px] text-night-muted">{guide.title}</span>}
          </div>
          <DrawerFacts
            items={[
              { label: "Moment", value: item.time },
              { label: "Durée", value: item.minutes != null ? minutesLabel(item.minutes) : "—" },
              { label: "Semaine", value: week ? `${week.prog === "tcf" ? "TCF" : "IELTS"} ${week.n}` : "—" },
            ]}
          />
        </>
      }
      footer={
        <div className="flex items-center gap-2">
          <button type="button" className={`btn flex-1 ${on ? "btn-ghost" : "btn-primary"}`} onClick={validate} disabled={!canEdit}>
            <IconCheck size={16} />
            {on ? "Fait · annuler" : "Marquer comme fait"}
          </button>
          {next && (
            <button type="button" className="btn btn-ghost" onClick={() => onSelect(next.key)}>
              Suivante
              <IconChevronRight size={16} />
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <DrawerCard title="À faire">
          <p className="text-[14px] leading-relaxed font-medium">{item.label}</p>
          {item.detail && <p className="mt-1 text-[13px] text-muted">{item.detail}</p>}
          {guide && <p className="mt-2 text-[13px] text-muted">{guide.why}</p>}
        </DrawerCard>

        <ExerciceCard date={plan.date} item={item} />

        {guide && (!withSubject || guide.table) && (
          <DrawerCard title={withSubject ? "Repères" : "Méthode"}>
            {!withSubject && (
              <ol className="flex flex-col gap-2">
                {guide.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug">
                    <span className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
            {guide.table && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-surface-2 text-muted">
                    <tr>
                      {guide.table.head.map((h) => (
                        <th key={h} className="px-2.5 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.table.rows.map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        {r.map((c, j) => (
                          <td key={j} className="px-2.5 py-1.5 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DrawerCard>
        )}

        {guide?.tips && guide.tips.length > 0 && (
          <DrawerCard title="Conseils et expressions">
            <ul className="flex flex-col gap-1.5">
              {guide.tips.map((t, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-snug">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </DrawerCard>
        )}

        {guide?.resources && guide.resources.length > 0 && (
          <DrawerCard title="Ressources">
            <ul className="-mx-2 flex flex-col">
              {guide.resources.map((r) => (
                <li key={r.name}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <IconExternal size={15} className="mt-0.5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">{r.name}</span>
                        {r.note && <span className="block text-[12px] text-muted">{r.note}</span>}
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-start gap-2.5 px-2 py-2">
                      <IconInfo size={15} className="mt-0.5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">{r.name}</span>
                        {r.note && <span className="block text-[12px] text-muted">{r.note}</span>}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </DrawerCard>
        )}

        {guide?.send && (
          <DrawerCard title="À envoyer à Claude">
            <dl className="flex flex-col gap-2 text-[13px]">
              <div>
                <dt className="text-[11.5px] font-semibold text-muted">Envoyer</dt>
                <dd>{guide.send.what}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-semibold text-muted">Vous recevez</dt>
                <dd>{guide.send.receive}</dd>
              </div>
            </dl>
          </DrawerCard>
        )}

        {week && (
          <DrawerCard title="Contexte de la semaine" sub={`${week.prog === "tcf" ? "TCF" : "IELTS"} · semaine ${week.n}`}>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div>
                <dt className="text-[11.5px] font-semibold text-muted">Thème de vocabulaire</dt>
                <dd className="font-semibold">{week.theme}</dd>
              </div>
              {week.grammar && (
                <div>
                  <dt className="text-[11.5px] font-semibold text-muted">Grammaire</dt>
                  <dd>{week.grammar}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11.5px] font-semibold text-muted">Objectif</dt>
                <dd>{week.goal}</dd>
              </div>
            </dl>
          </DrawerCard>
        )}
        {plan.tip && <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted">{plan.tip}</p>}
        <div className="h-2" />
      </div>
    </Drawer>
  );
}
