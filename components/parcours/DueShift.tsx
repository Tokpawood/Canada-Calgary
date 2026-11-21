"use client";

import { useState } from "react";
import { addBusinessDays } from "@/lib/businessDays";
import { addDays } from "@/lib/formation";
import { fmtShortDate } from "@/components/ui";
import { IconCalendar } from "@/components/icons";

const todayAbidjan = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });

/**
 * Report d'échéance : « délai de N jours ouvrables à compter du … ».
 * Calcule la nouvelle date et peut noter le report (avec son motif) dans les notes de l'étape.
 */
export function DueShift({ due, onApply }: { due: string | null; onApply: (newDue: string, note: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(due ?? todayAbidjan());
  const [days, setDays] = useState("10");
  const [kind, setKind] = useState<"ouvrables" | "calendaires">("ouvrables");
  const [reason, setReason] = useState("");
  const [keepTrace, setKeepTrace] = useState(true);

  const n = Number.parseInt(days, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && Number.isFinite(n) && n >= 0 && n <= 365;
  const result = valid ? (kind === "ouvrables" ? addBusinessDays(from, n) : addDays(from, n)) : null;

  if (!open)
    return (
      <button type="button" className="btn btn-ghost btn-sm col-span-2 justify-self-start" onClick={() => setOpen(true)}>
        <IconCalendar size={14} /> Reporter selon un délai…
      </button>
    );

  return (
    <div className="col-span-2 rounded-xl bg-surface-2 p-3">
      <p className="text-[13px] font-semibold">Nouveau délai accordé</p>
      <div className="mt-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[5rem_10rem_minmax(0,1fr)]">
        <label>
          <span className="field-label">Délai</span>
          <input id="due-shift-days" type="number" min={0} max={365} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="input mono" />
        </label>
        <label>
          <span className="field-label">Jours</span>
          <select id="due-shift-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="input">
            <option value="ouvrables">ouvrables</option>
            <option value="calendaires">calendaires</option>
          </select>
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className="field-label">À compter du</span>
          <input id="due-shift-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </label>
        <label className="col-span-2 sm:col-span-3">
          <span className="field-label">Motif (facultatif)</span>
          <input id="due-shift-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. modification demandée par le ministère de l'Intérieur" className="input" />
        </label>
      </div>
      <p className="mt-2.5 text-[13px]" role="status">
        {result ? (
          <>
            Nouvelle échéance : <span className="mono font-semibold">{fmtShortDate(result)}</span>
            {kind === "ouvrables" && <span className="text-muted"> (week-ends et jours fériés ivoiriens exclus ; le jour de départ ne compte pas)</span>}
          </>
        ) : (
          <span className="text-bad">Indiquez une date de départ et un délai entre 0 et 365 jours.</span>
        )}
      </p>
      <label className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
        <input id="due-shift-trace" type="checkbox" checked={keepTrace} onChange={(e) => setKeepTrace(e.target.checked)} className="h-4 w-4 accent-[var(--act)]" />
        Noter le report dans les notes de l&apos;étape
      </label>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!result}
          onClick={() => {
            if (!result) return;
            const note = keepTrace
              ? `Échéance reportée${due ? ` du ${fmtShortDate(due)}` : ""} au ${fmtShortDate(result)} : délai de ${n} jour${n > 1 ? "s" : ""} ${kind} à compter du ${fmtShortDate(from)}${reason.trim() ? ` (${reason.trim()})` : ""}.`
              : null;
            onApply(result, note);
            setOpen(false);
          }}
        >
          Appliquer
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Les fêtes musulmanes (Tabaski, Ramadan, Maouloud) ne sont pas déduites : vérifiez si le délai en contient une.</p>
    </div>
  );
}
