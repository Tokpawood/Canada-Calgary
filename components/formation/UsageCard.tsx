import { usageTotals, type UsageRow } from "@/lib/aiUsage";

const usd = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $ US`;

/** Consommation estimée de l'API Claude par la formation. */
export function UsageCard({
  rows,
  today,
}: {
  rows: UsageRow[];
  today: string;
}) {
  const t = usageTotals(rows, today);
  const tiles: Array<[string, number]> = [
    ["Aujourd'hui", t.today],
    ["Ce mois-ci", t.month],
    ["Par jour utilisé", t.perDay],
  ];
  return (
    <section
      className="card mt-4 px-4 py-4 sm:px-5"
      aria-labelledby="conso-claude"
    >
      <h2 id="conso-claude" className="text-[15px] font-bold">
        Consommation Claude
      </h2>
      <p className="text-[12.5px] text-muted">
        Estimation, mesurée depuis le 23 novembre 2026 et mise à jour au
        chargement de la page. Le montant exact est sur platform.claude.com.
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map(([label, v]) => (
          <div key={label} className="rounded-xl bg-surface-2 px-3 py-2">
            <dt className="text-[11.5px] text-muted">{label}</dt>
            <dd className="mono text-[15px] font-semibold">{usd(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
