"use client";

import { useState } from "react";
import { CURRENCIES, convert, formatAmount, parseAmount, type Currency, type Rates } from "@/lib/currency";
import { IconRefresh } from "@/components/icons";

interface Props {
  rates: Rates | null;
  /** Taux enregistré du dossier (FCFA pour 1 $ CA), utilisé au choix ou quand le taux du jour est indisponible. */
  savedCadRate: number;
}

type Source = "jour" | "perso";

/** Convertisseur dans les deux sens : on saisit d'un côté ou de l'autre, l'autre montant suit. */
export function Converter({ rates, savedCadRate }: Props) {
  const [from, setFrom] = useState<Currency>("XOF");
  const [to, setTo] = useState<Currency>("CAD");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [edited, setEdited] = useState<"left" | "right">("left");
  const [source, setSource] = useState<Source>(rates ? "jour" : "perso");

  // Sans taux du jour, seuls le FCFA et le dollar canadien (taux enregistré) sont disponibles.
  const perXof: Partial<Record<Currency, number>> =
    source === "jour" && rates ? rates.perXof : { ...(rates?.perXof ?? { XOF: 1 }), XOF: 1, CAD: savedCadRate > 0 ? savedCadRate : undefined };
  const available = CURRENCIES.filter((c) => (perXof[c.code] ?? 0) > 0);
  const ok = (perXof[from] ?? 0) > 0 && (perXof[to] ?? 0) > 0;
  const table = perXof as Record<Currency, number>;

  const compute = (raw: string, a: Currency, b: Currency) => {
    const n = parseAmount(raw);
    return raw.trim() && Number.isFinite(n) && ok ? formatAmount(convert(n, a, b, table), b) : "";
  };
  const leftShown = edited === "left" ? left : compute(right, to, from);
  const rightShown = edited === "right" ? right : compute(left, from, to);

  function swap() {
    setFrom(to);
    setTo(from);
    // Le montant saisi garde sa devise : il change simplement de côté.
    if (edited === "left") {
      setRight(left);
      setEdited("right");
    } else {
      setLeft(right);
      setEdited("left");
    }
  }

  const unit = (c: Currency) => CURRENCIES.find((x) => x.code === c)?.symbol ?? c;
  const fmtRate = (n: number) => new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: 5 }).format(n);
  const rateLine = ok ? `1 ${unit(from)} = ${fmtRate(convert(1, from, to, table))} ${unit(to)} · 1 ${unit(to)} = ${fmtRate(convert(1, to, from, table))} ${unit(from)}` : "Taux indisponible pour cette devise.";
  const dateLabel = rates ? new Date(`${rates.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  const Side = ({ side, value, cur, onCur }: { side: "left" | "right"; value: string; cur: Currency; onCur: (c: Currency) => void }) => (
    <div className="flex min-w-0 overflow-hidden rounded-xl border border-line bg-surface focus-within:border-act">
      <input
        value={value}
        onChange={(e) => {
          if (side === "left") setLeft(e.target.value);
          else setRight(e.target.value);
          setEdited(side);
        }}
        inputMode="decimal"
        placeholder="0"
        aria-label={`Montant en ${CURRENCIES.find((c) => c.code === cur)?.label}`}
        className="mono min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right text-[17px] font-semibold outline-none"
      />
      <select value={cur} onChange={(e) => onCur(e.target.value as Currency)} aria-label="Devise" className="border-l border-line bg-surface-2 px-2 text-[13px] font-semibold outline-none">
        {available.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">Convertisseur</h2>
          <p className="text-[12.5px] text-muted">Saisissez un montant d&apos;un côté ou de l&apos;autre.</p>
        </div>
        <div role="radiogroup" aria-label="Taux utilisé" className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ["jour", "Taux du jour"],
              ["perso", "Mon taux"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={source === v}
              disabled={v === "jour" && !rates}
              onClick={() => setSource(v)}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold disabled:opacity-40 ${source === v ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {Side({ side: "left", value: leftShown, cur: from, onCur: (c) => (c === to ? swap() : setFrom(c)) })}
        <button type="button" onClick={swap} className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-line text-muted hover:border-act hover:text-act" aria-label="Inverser les devises" title="Inverser">
          <IconRefresh size={15} />
        </button>
        {Side({ side: "right", value: rightShown, cur: to, onCur: (c) => (c === from ? swap() : setTo(c)) })}
      </div>

      <p className="mono mt-3 text-[12.5px] text-muted">{rateLine}</p>
      <p className="mt-1 text-[11.5px] text-faint">
        {source === "jour" && rates
          ? `Taux de référence ${rates.source} du ${dateLabel} (franc CFA à parité fixe avec l'euro : 1 € = 655,957 FCFA). Votre banque applique en plus sa marge.`
          : rates
            ? "Dollar canadien au taux enregistré ci-contre ; autres devises au taux du jour."
            : "Taux du jour indisponible pour le moment : conversion au taux enregistré."}
      </p>
    </section>
  );
}
