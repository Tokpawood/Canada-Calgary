"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AI_BUDGET,
  AI_LIMIT,
  USD_TO_XOF,
  monthProjection,
  usageBy,
  usageTotals,
  type UsageRow,
} from "@/lib/aiUsage";
import { Meter } from "@/components/ui";
import { IconRefresh } from "@/components/icons";

const usd = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const xof = (n: number) =>
  `≈ ${Math.round(n * USD_TO_XOF).toLocaleString("fr-FR")} F`;
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    ...o,
    timeZone: "UTC",
  });

const TASK_LABEL: Record<string, string> = {
  questions: "Questions des tests et examens blancs",
  recherche: "Recherche internet",
  exercices: "Exercices du jour",
  "correction exercices": "Correction des exercices",
  "correction expression": "Correction des expressions",
};

/** Suivi de la consommation de l'API Claude : budget du mois, postes, jours et mois précédents. */
export function UsageView({
  rows,
  today,
}: {
  rows: UsageRow[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Chiffres à jour à l'ouverture de l'onglet : un test a pu être préparé depuis le chargement.
  useEffect(() => {
    router.refresh();
  }, [router]);

  const t = usageTotals(rows, today);
  const projection = monthProjection(t, today);
  const inMonth = rows.filter((r) => r.day.slice(0, 7) === today.slice(0, 7));
  const tasks = usageBy(inMonth, (r) => r.task).sort((a, b) => b.cost - a.cost);
  const days = usageBy(rows, (r) => r.day)
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 14);
  const months = usageBy(rows, (r) => r.day.slice(0, 7)).sort((a, b) =>
    b.key.localeCompare(a.key),
  );
  const pct = (t.month / AI_BUDGET) * 100;
  const state =
    t.month >= AI_LIMIT
      ? { tone: "bad" as const, text: "Limite de dépense atteinte" }
      : t.month >= AI_BUDGET
        ? { tone: "bad" as const, text: "Budget du mois dépassé" }
        : pct >= 80
          ? { tone: "bad" as const, text: "Plus de 80 % du budget utilisé" }
          : { tone: "ok" as const, text: "Dans le budget" };

  return (
    <div className="flex flex-col gap-4">
      <section className="card px-4 py-4 sm:px-5" aria-labelledby="conso-mois">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="conso-mois" className="text-[16px] font-bold">
              Consommation Claude ·{" "}
              {fmt(today, { month: "long", year: "numeric" })}
            </h2>
            <p className="text-[12.5px] text-muted">
              Estimation en dollars américains, mesurée depuis le 23 novembre
              2026.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <IconRefresh size={14} /> {pending ? "Mise à jour…" : "Actualiser"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <p>
            <span className="mono text-[32px] leading-none font-bold">
              {usd(t.month)}
            </span>
            <span className="ml-2 text-[13px] text-muted">
              sur {usd(AI_BUDGET)} · {xof(t.month)}
            </span>
          </p>
          <p
            className={`text-[13px] font-semibold ${state.tone === "ok" ? "text-ok" : "text-bad"}`}
          >
            {state.text}
          </p>
        </div>
        <Meter
          value={Math.min(100, pct)}
          tone={state.tone}
          className="mt-2"
          label={`${usd(t.month)} dépensés sur ${usd(AI_BUDGET)}`}
        />
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Aujourd'hui", usd(t.today), xof(t.today)],
              ["Par jour utilisé", usd(t.perDay), xof(t.perDay)],
              [
                "Fin de mois, à ce rythme",
                projection === null ? "—" : usd(projection),
                projection === null ? "après 3 jours" : xof(projection),
              ],
              [
                "Reste du budget",
                usd(Math.max(0, AI_BUDGET - t.month)),
                `limite conseillée ${usd(AI_LIMIT)}`,
              ],
            ] as const
          ).map(([label, v, sub]) => (
            <div key={label} className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-[11.5px] text-muted">{label}</dt>
              <dd className="mono text-[16px] font-semibold">{v}</dd>
              <dd className="text-[11.5px] text-muted">{sub}</dd>
            </div>
          ))}
        </dl>
      </section>

      {rows.length === 0 ? (
        <p className="card px-4 py-6 text-center text-[13px] text-muted">
          Aucune consommation enregistrée pour l&apos;instant. Elle apparaîtra
          ici dès le prochain test, exercice ou correction.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <List
            title="Par poste ce mois-ci"
            items={tasks.map((x) => ({
              ...x,
              label: TASK_LABEL[x.key] ?? x.key,
            }))}
          />
          <List
            title="Par jour"
            items={days.map((x) => ({
              ...x,
              label: fmt(x.key, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
            }))}
          />
          <List
            title="Par mois"
            items={months.map((x) => ({
              ...x,
              label: fmt(`${x.key}-01`, { month: "long", year: "numeric" }),
            }))}
          />
        </div>
      )}

      <p className="text-[12px] text-muted">
        Un appel interrompu peut manquer ; le montant facturé fait foi sur
        platform.claude.com, où se règle aussi la limite de dépense. FCFA
        calculés à {USD_TO_XOF} F pour 1 $.
      </p>
    </div>
  );
}

function List({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; cost: number; calls: number }>;
}) {
  const max = Math.max(...items.map((x) => x.cost), 0.0001);
  return (
    <section className="card px-4 py-4 sm:px-5">
      <h3 className="text-[14.5px] font-bold">{title}</h3>
      {items.length === 0 && (
        <p className="mt-2 text-[12.5px] text-muted">Rien ce mois-ci.</p>
      )}
      <ul className="mt-2 flex flex-col gap-2.5">
        {items.map((x) => (
          <li key={x.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span>
                {x.label}
                <span className="ml-1.5 text-[11.5px] text-muted">
                  {x.calls} appel{x.calls > 1 ? "s" : ""}
                </span>
              </span>
              <span className="mono font-semibold">{usd(x.cost)}</span>
            </div>
            <Meter
              value={(x.cost / max) * 100}
              className="mt-1"
              label={`${x.label} : ${usd(x.cost)}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
