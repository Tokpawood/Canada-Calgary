"use client";

import { eighteenthBirthdayIso, pd, today0 } from "@/lib/rules";
import type { AddressEntry, HistoryEntry, HistoryType } from "@/lib/types";
import type { ReactNode } from "react";
import { Chip, TONE_DOT, type Tone } from "@/components/ui";
import { IconAlert, IconBriefcase, IconCheck, IconHome, IconPlus, IconTrash } from "@/components/icons";

const HISTORY_TYPES: HistoryType[] = ["Travail", "Études", "Sans emploi", "Autre"];

interface TimelineRow {
  id: string;
  from: string;
  to: string;
  parallel: boolean;
  label: string;
}

/** Frise de couverture : du 18e anniversaire à aujourd'hui ; le fond visible correspond aux périodes non déclarées. */
function CoverageTimeline({ rows, naissance }: { rows: TimelineRow[]; naissance: string | null }) {
  const start = pd(eighteenthBirthdayIso(naissance));
  const end = today0();
  if (!start || end <= start) return null;
  const span = end.getTime() - start.getTime();

  const toPct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - start.getTime()) / span) * 100));
  const segs = rows
    .map((r) => {
      const f = pd(r.from);
      const e = r.to ? pd(r.to, true) : end;
      if (!f || !e || e < start) return null;
      const left = toPct(f);
      const right = toPct(e);
      if (right <= left) return null;
      return { ...r, left, width: right - left, period: `${r.from} → ${r.to || "aujourd'hui"}` };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const main = segs.filter((s) => !s.parallel);
  const parallel = segs.filter((s) => s.parallel);

  const firstYear = start.getUTCFullYear() + 1;
  const lastYear = end.getUTCFullYear();
  const step = Math.max(1, Math.ceil((lastYear - firstYear + 1) / 6));
  const ticks: number[] = [];
  for (let y = firstYear; y <= lastYear; y += step) ticks.push(y);

  return (
    <div className="mt-4">
      <div className="relative h-6 overflow-hidden rounded-md bg-bad-bg" role="img" aria-label="Frise de couverture des périodes déclarées">
        {main.map((s) => (
          <span
            key={s.id}
            title={`${s.label} · ${s.period}`}
            className="absolute inset-y-0 bg-act hover:brightness-125"
            style={{ left: `${s.left}%`, width: `${s.width}%`, boxShadow: "inset -2px 0 0 var(--surface)" }}
          />
        ))}
      </div>
      {parallel.length > 0 && (
        <div className="relative mt-1 h-2 rounded-full bg-surface-2">
          {parallel.map((s) => (
            <span key={s.id} title={`${s.label} (en parallèle) · ${s.period}`} className="absolute inset-y-0 rounded-full bg-run/60" style={{ left: `${s.left}%`, width: `${s.width}%` }} />
          ))}
        </div>
      )}
      <div className="mono relative mt-1 h-4 text-[10.5px] text-faint">
        {ticks.map((y) => {
          const left = toPct(new Date(Date.UTC(y, 0, 1)));
          return (
            <span key={y} className="absolute -translate-x-1/2" style={{ left: `${left}%` }}>
              {y}
            </span>
          );
        })}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-act" /> Période déclarée
        </li>
        {parallel.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-run/60" /> En parallèle
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-bad/30 bg-bad-bg" /> Non déclaré
        </li>
      </ul>
    </div>
  );
}

function GapList({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-ok">
        <IconCheck size={14} /> Aucun trou de plus de 4 jours.
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {gaps.map((g, i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg bg-bad-bg px-2.5 py-1.5 text-[12.5px] text-bad">
          <IconAlert size={14} className="mt-px shrink-0" />
          {g}
        </li>
      ))}
    </ul>
  );
}

function SectionHead({
  title,
  sub,
  onAdd,
  addLabel,
  editing,
  actions,
  icon,
  count,
  gaps,
}: {
  title: string;
  sub: string;
  onAdd: () => void;
  addLabel: string;
  editing: boolean;
  actions?: ReactNode;
  icon: ReactNode;
  count: string;
  gaps: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-act-soft text-act">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold">{title}</h2>
          <p className="text-[12.5px] text-muted">{sub}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip tone="todo">{count}</Chip>
            <Chip tone={gaps ? "bad" : "ok"} dot>
              {gaps ? `${gaps} trou(s) à justifier` : "aucun trou"}
            </Chip>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editing && (
          <button type="button" onClick={onAdd} className="btn btn-sm btn-soft">
            <IconPlus size={14} /> {addLabel}
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

const TH = "px-1.5 py-2 text-left text-[11.5px] font-medium text-muted";

interface HistoryProps {
  rows: HistoryEntry[];
  gaps: string[];
  naissance: string | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<HistoryEntry>) => void;
  onDelete: (id: string) => void;
  editing: boolean;
  actions?: ReactNode;
}

export function HistoryTable({ rows, gaps, naissance, onAdd, onUpdate, onDelete, editing, actions }: HistoryProps) {
  const off = !editing;
  return (
    <section className={`card p-4 sm:p-5 ${editing ? "ring-2 ring-act-soft" : ""}`}>
      <SectionHead title="Historique personnel" sub="Toutes les activités depuis vos 18 ans, sans trou de plus de 4 jours." onAdd={onAdd} addLabel="Période" editing={editing} actions={actions} icon={<IconBriefcase size={18} />} count={`${rows.length} période(s)`} gaps={gaps.length} />
      <CoverageTimeline naissance={naissance} rows={rows.map((r) => ({ id: r.id, from: r.from, to: r.to, parallel: r.parallel, label: r.activity || r.type }))} />
      <GapList gaps={gaps} />
      {!editing ? (
        <PeriodList
          items={rows.map((r) => ({
            id: r.id,
            from: r.from,
            to: r.to,
            parallel: r.parallel,
            title: r.activity || r.type,
            sub: [r.org, r.place].filter(Boolean).join(" · "),
            tag: r.type,
            tone: TYPE_TONE[r.type],
          }))}
          ongoing="en cours"
          empty="Aucune période déclarée."
        />
      ) : (
      <div className="-mx-1.5 mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className={`${TH} w-[112px]`}>Du</th>
              <th className={`${TH} w-[112px]`}>Au</th>
              <th className={`${TH} w-[120px]`}>Type</th>
              <th className={TH}>Activité</th>
              <th className={TH}>Organisme</th>
              <th className={TH}>Lieu</th>
              <th className={`${TH} w-[64px] text-center`} title="Période en parallèle d'une autre (exclue du calcul des trous)">
                Parallèle
              </th>
              {editing && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group border-b border-line last:border-0">
                <Cell off={off} value={r.from} mono onChange={(v) => onUpdate(r.id, { from: v })} placeholder="AAAA-MM-JJ" label="Début" />
                <Cell off={off} value={r.to} mono onChange={(v) => onUpdate(r.id, { to: v })} placeholder="en cours" label="Fin" />
                <td className="px-0.5 py-1">
                  <select disabled={off} value={r.type} onChange={(e) => onUpdate(r.id, { type: e.target.value as HistoryType })} className="input-ghost" aria-label="Type">
                    {HISTORY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <Cell off={off} value={r.activity} onChange={(v) => onUpdate(r.id, { activity: v })} label="Activité" />
                <Cell off={off} value={r.org} onChange={(v) => onUpdate(r.id, { org: v })} label="Organisme" />
                <Cell off={off} value={r.place} onChange={(v) => onUpdate(r.id, { place: v })} label="Lieu" />
                <td className="py-1 text-center">
                  <input type="checkbox" disabled={off} checked={r.parallel} onChange={(e) => onUpdate(r.id, { parallel: e.target.checked })} aria-label="En parallèle" className="h-4 w-4 accent-[var(--act)]" />
                </td>
                {editing && (
                  <td className="py-1 text-right">
                    <RowDelete onDelete={() => onDelete(r.id)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

interface AddressProps {
  rows: AddressEntry[];
  gaps: string[];
  naissance: string | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<AddressEntry>) => void;
  onDelete: (id: string) => void;
  editing: boolean;
  actions?: ReactNode;
}

export function AddressesTable({ rows, gaps, naissance, onAdd, onUpdate, onDelete, editing, actions }: AddressProps) {
  const off = !editing;
  return (
    <section className={`card p-4 sm:p-5 ${editing ? "ring-2 ring-act-soft" : ""}`}>
      <SectionHead title="Adresses" sub="Toutes les adresses de résidence depuis vos 18 ans." onAdd={onAdd} addLabel="Adresse" editing={editing} actions={actions} icon={<IconHome size={18} />} count={`${rows.length} adresse(s)`} gaps={gaps.length} />
      <CoverageTimeline naissance={naissance} rows={rows.map((r) => ({ id: r.id, from: r.from, to: r.to, parallel: r.parallel, label: [r.address, r.city].filter(Boolean).join(", ") || "Adresse" }))} />
      <GapList gaps={gaps} />
      {!editing ? (
        <PeriodList
          items={rows.map((r) => ({
            id: r.id,
            from: r.from,
            to: r.to,
            parallel: r.parallel,
            title: r.address || "Adresse à préciser",
            sub: [r.city, r.note].filter(Boolean).join(" · "),
            tone: "act" as Tone,
          }))}
          ongoing="adresse actuelle"
          empty="Aucune adresse déclarée."
        />
      ) : (
      <div className="-mx-1.5 mt-3 overflow-x-auto">
        <table className="w-full min-w-[700px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className={`${TH} w-[112px]`}>Du</th>
              <th className={`${TH} w-[112px]`}>Au</th>
              <th className={TH}>Adresse</th>
              <th className={TH}>Ville, pays</th>
              <th className={TH}>Note</th>
              {editing && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group border-b border-line last:border-0">
                <Cell off={off} value={r.from} mono onChange={(v) => onUpdate(r.id, { from: v })} placeholder="AAAA-MM-JJ" label="Début" />
                <Cell off={off} value={r.to} mono onChange={(v) => onUpdate(r.id, { to: v })} placeholder="actuelle" label="Fin" />
                <Cell off={off} value={r.address} onChange={(v) => onUpdate(r.id, { address: v })} label="Adresse" />
                <Cell off={off} value={r.city} onChange={(v) => onUpdate(r.id, { city: v })} label="Ville, pays" />
                <Cell off={off} value={r.note} onChange={(v) => onUpdate(r.id, { note: v })} label="Note" />
                {editing && (
                  <td className="py-1 text-right">
                    <RowDelete onDelete={() => onDelete(r.id)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

const TYPE_TONE: Record<HistoryType, Tone> = { Travail: "act", Études: "run", "Sans emploi": "opt", Autre: "todo" };

interface PeriodItem {
  id: string;
  from: string;
  to: string;
  parallel: boolean;
  title: string;
  sub: string;
  tag?: string;
  tone: Tone;
}

function fmtPeriodDate(v: string): string {
  const d = pd(v);
  if (!d) return v || "?";
  const hasDay = /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
  return d.toLocaleDateString("fr-FR", { ...(hasDay ? { day: "numeric" } : {}), month: "short", year: "numeric", timeZone: "UTC" });
}

function duration(from: string, to: string): string {
  const a = pd(from);
  const b = to ? pd(to, true) : today0();
  if (!a || !b || b < a) return "";
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y && !m) return "moins d'un mois";
  return [y ? `${y} an${y > 1 ? "s" : ""}` : "", m ? `${m} mois` : ""].filter(Boolean).join(" ");
}

/** Lecture : frise verticale, de la période la plus récente à la plus ancienne. */
function PeriodList({ items, ongoing, empty }: { items: PeriodItem[]; ongoing: string; empty: string }) {
  if (items.length === 0) return <p className="mt-4 text-[13px] text-faint">{empty}</p>;
  const sorted = [...items].sort((a, b) => (pd(b.from)?.getTime() ?? 0) - (pd(a.from)?.getTime() ?? 0));
  return (
    <ol className="relative mt-4 ml-1.5 border-l-2 border-line">
      {sorted.map((it) => (
        <li key={it.id} className="relative pb-4 pl-5 last:pb-0">
          <span className={`absolute top-1.5 -left-[7px] h-3 w-3 rounded-full ring-4 ring-surface ${TONE_DOT[it.tone]} ${it.parallel ? "opacity-50" : ""}`} aria-hidden />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="mono text-[12px] font-semibold text-muted">
              {fmtPeriodDate(it.from)} → {it.to ? fmtPeriodDate(it.to) : <span className="text-ok">{ongoing}</span>}
            </span>
            {duration(it.from, it.to) && <span className="text-[11.5px] text-faint">· {duration(it.from, it.to)}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold">{it.title}</span>
            {it.tag && <Chip tone={it.tone}>{it.tag}</Chip>}
            {it.parallel && <Chip tone="todo">en parallèle</Chip>}
          </div>
          {it.sub && <p className="mt-0.5 text-[12.5px] text-muted">{it.sub}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Retire la ligne du brouillon ; rien n'est supprimé en base avant « Enregistrer ». */
function RowDelete({ onDelete }: { onDelete: () => void }) {
  return (
    <button type="button" onClick={onDelete} aria-label="Retirer la ligne" title="Retirer la ligne" className="btn btn-sm btn-danger">
      <IconTrash size={13} />
    </button>
  );
}

function Cell({ value, onChange, placeholder, mono, label, off }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; label: string; off: boolean }) {
  return (
    <td className="px-0.5 py-1">
      <input value={value} disabled={off} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} className={`input-ghost min-w-[90px] ${off ? "" : "border-line bg-surface"} ${mono ? "mono text-[12.5px]" : ""}`} />
    </td>
  );
}
