"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AI_BUDGET,
  USD_TO_XOF,
  usageTotals,
  type UsageRow,
} from "@/lib/aiUsage";

const usd = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const cfa = (n: number) =>
  `${Math.round(n * USD_TO_XOF).toLocaleString("fr-FR")} F CFA`;
const R = 88;
const C = 2 * Math.PI * R;

/** Consommation Claude du mois : un cercle rempli selon le budget. */
export function UsageView({
  rows,
  today,
}: {
  rows: UsageRow[];
  today: string;
}) {
  const router = useRouter();
  // Chiffres à jour à l'ouverture de l'onglet : un test a pu être préparé depuis le chargement.
  useEffect(() => {
    router.refresh();
  }, [router]);

  const t = usageTotals(rows, today);
  const pct = (t.month / AI_BUDGET) * 100;
  const alert = pct >= 80;
  const left = AI_BUDGET - t.month;

  return (
    <section
      className="card flex flex-col items-center px-4 py-10"
      aria-label="Consommation Claude du mois"
    >
      <p className="eyebrow">
        {new Date(`${today}T12:00:00Z`).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </p>
      <svg
        viewBox="0 0 200 200"
        className="mt-4 h-60 w-60"
        role="img"
        aria-label={`${usd(t.month)} dépensés (${cfa(t.month)}) sur ${usd(AI_BUDGET)}, soit ${Math.round(pct)} %`}
      >
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="10"
        />
        {t.month > 0 && (
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={alert ? "var(--bad)" : "var(--signal)"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(Math.min(100, pct) / 100) * C} ${C}`}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dasharray .5s" }}
          />
        )}
        <text
          x="100"
          y="98"
          textAnchor="middle"
          fontSize="32"
          fontWeight="700"
          fill="var(--ink)"
          fontFamily="var(--font-mono)"
        >
          {usd(t.month)}
        </text>
        <text
          x="100"
          y="120"
          textAnchor="middle"
          fontSize="12"
          fill="var(--muted)"
        >
          ≈ {cfa(t.month)}
        </text>
        <text
          x="100"
          y="140"
          textAnchor="middle"
          fontSize="11"
          fill="var(--muted)"
        >
          sur {AI_BUDGET} $
        </text>
      </svg>
      <p
        className={`mt-4 text-[14px] font-semibold ${alert ? "text-bad" : ""}`}
      >
        {left >= 0
          ? `Reste ${usd(left)} · ${cfa(left)}`
          : `Budget dépassé de ${usd(-left)} · ${cfa(-left)}`}
      </p>
      <p className="mt-1 text-[12.5px] text-muted">
        Aujourd&apos;hui {usd(t.today)} · {cfa(t.today)}
      </p>
      <p className="mt-1 text-[12.5px] text-muted">
        Budget du mois {usd(AI_BUDGET)} · {cfa(AI_BUDGET)}
      </p>
      <p className="mt-4 text-[11.5px] text-muted">
        Estimation depuis le 23 novembre 2026 · 1 $ ≈ {USD_TO_XOF} F CFA
      </p>
    </section>
  );
}
