import { describe, expect, it } from "vitest";
import { bankMarginPct, overdueTotal, rateError } from "./budget";

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
});
