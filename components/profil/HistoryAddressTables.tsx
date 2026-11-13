"use client";

import type { AddressEntry, HistoryEntry, HistoryType } from "@/lib/types";

const HISTORY_TYPES: HistoryType[] = ["Travail", "Études", "Sans emploi", "Autre"];

interface HistoryProps {
  rows: HistoryEntry[];
  gaps: string[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<HistoryEntry>) => void;
  onDelete: (id: string) => void;
}

export function HistoryTable({ rows, gaps, onAdd, onUpdate, onDelete }: HistoryProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Historique personnel depuis 18 ans</h3>
        <button type="button" onClick={onAdd} className="rounded-md bg-act-soft px-2.5 py-1 text-xs font-semibold text-act">
          + Période
        </button>
      </div>
      {gaps.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {gaps.map((g, i) => (
            <li key={i} className="rounded-md bg-bad-bg px-2 py-1 text-xs text-bad">
              {g}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 pr-2">Du</th>
              <th className="py-1 pr-2">Au</th>
              <th className="py-1 pr-2">Type</th>
              <th className="py-1 pr-2">Activité</th>
              <th className="py-1 pr-2">Organisme</th>
              <th className="py-1 pr-2">Lieu</th>
              <th className="py-1 pr-2">//</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <Cell value={r.from} onChange={(v) => onUpdate(r.id, { from: v })} placeholder="AAAA-MM-JJ" />
                <Cell value={r.to} onChange={(v) => onUpdate(r.id, { to: v })} placeholder="en cours si vide" />
                <td className="py-1 pr-2">
                  <select value={r.type} onChange={(e) => onUpdate(r.id, { type: e.target.value as HistoryType })} className="rounded-md border border-line px-1 py-0.5 text-sm">
                    {HISTORY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <Cell value={r.activity} onChange={(v) => onUpdate(r.id, { activity: v })} />
                <Cell value={r.org} onChange={(v) => onUpdate(r.id, { org: v })} />
                <Cell value={r.place} onChange={(v) => onUpdate(r.id, { place: v })} />
                <td className="py-1 pr-2 text-center">
                  <input type="checkbox" checked={r.parallel} onChange={(e) => onUpdate(r.id, { parallel: e.target.checked })} />
                </td>
                <td className="py-1">
                  <button type="button" onClick={() => onDelete(r.id)} className="text-xs text-faint hover:text-bad">
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AddressProps {
  rows: AddressEntry[];
  gaps: string[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<AddressEntry>) => void;
  onDelete: (id: string) => void;
}

export function AddressesTable({ rows, gaps, onAdd, onUpdate, onDelete }: AddressProps) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Adresses depuis 18 ans</h3>
        <button type="button" onClick={onAdd} className="rounded-md bg-act-soft px-2.5 py-1 text-xs font-semibold text-act">
          + Adresse
        </button>
      </div>
      {gaps.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {gaps.map((g, i) => (
            <li key={i} className="rounded-md bg-bad-bg px-2 py-1 text-xs text-bad">
              {g}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 pr-2">Du</th>
              <th className="py-1 pr-2">Au</th>
              <th className="py-1 pr-2">Adresse</th>
              <th className="py-1 pr-2">Ville, pays</th>
              <th className="py-1 pr-2">Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <Cell value={r.from} onChange={(v) => onUpdate(r.id, { from: v })} placeholder="AAAA-MM-JJ" />
                <Cell value={r.to} onChange={(v) => onUpdate(r.id, { to: v })} placeholder="actuelle si vide" />
                <Cell value={r.address} onChange={(v) => onUpdate(r.id, { address: v })} />
                <Cell value={r.city} onChange={(v) => onUpdate(r.id, { city: v })} />
                <Cell value={r.note} onChange={(v) => onUpdate(r.id, { note: v })} />
                <td className="py-1">
                  <button type="button" onClick={() => onDelete(r.id)} className="text-xs text-faint hover:text-bad">
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <td className="py-1 pr-2">
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full min-w-[90px] rounded-md border border-line px-1.5 py-0.5 text-sm" />
    </td>
  );
}
