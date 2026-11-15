import { describe, expect, it } from "vitest";
import { bankMarginPct, budgetTotals, overdueTotal, rateError } from "./budget";

describe("budget", () => {
  it("vérifie le taux enregistré et calcule la marge de la banque", () => {
    expect(rateError(430)).toBeNull();
    expect(rateError(0)).not.toBeNull();
    expect(rateError(4.3)).not.toBeNull();
    expect(bankMarginPct(440, 400)).toBeCloseTo(10, 6);
    expect(bankMarginPct(440, null)).toBeNull();
  });

  it("additionne les dépenses en retard", () => {
    const items = [
      { due: "2026-11-01", planned: 10 },
      { due: "2026-11-20", planned: 5 },
      { due: null, planned: 7 },
    ];
    expect(overdueTotal(items, "2026-11-15")).toEqual({ count: 1, total: 10 });
  });

  it("n'efface pas le reste d'une phase avec le dépassement d'une autre", () => {
    const t = budgetTotals([
      { planned: 100, actual: 150 },
      { planned: 100, actual: 0 },
    ]);
    expect(t).toEqual({ planned: 200, actual: 150, remaining: 100, over: 50 });
    expect(budgetTotals([])).toEqual({ planned: 0, actual: 0, remaining: 0, over: 0 });
  });
});
