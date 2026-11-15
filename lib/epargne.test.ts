import { describe, expect, it } from "vitest";
import { fundsError, monthIndex, monthsFromNow, parseMonthLabel, savingsError, suggestNextLabel } from "./epargne";
import { effectiveFundsMin } from "./epargne";

describe("libellés de mois", () => {
  it("reconnaît les mois complets, abrégés ou sans accents", () => {
    expect(monthIndex("Décembre")).toBe(11);
    expect(monthIndex("fevrier")).toBe(1);
    expect(monthIndex("déc.")).toBe(11);
    expect(monthIndex("jui")).toBe(-1);
    expect(monthIndex("juil")).toBe(6);
    expect(parseMonthLabel("Août 2027")).toEqual({ month: 7, year: 2027 });
    expect(parseMonthLabel("Prime")).toBeNull();
  });

  it("propose le mois suivant le dernier versement reconnu", () => {
    expect(suggestNextLabel(["Novembre 2026"])).toBe("Décembre 2026");
    expect(suggestNextLabel(["Décembre 2026", "Bonus"])).toBe("Janvier 2027");
    expect(suggestNextLabel([], new Date(2026, 10, 15))).toBe("Novembre 2026");
  });

  it("projette une échéance en mois", () => {
    expect(monthsFromNow(3, new Date(2026, 10, 15))).toBe("février 2027");
  });
});

describe("contrôles de saisie", () => {
  it("refuse les montants négatifs et une cible inférieure au minimum", () => {
    expect(savingsError([{ planned: 100, actual: null }])).toBeNull();
    expect(savingsError([{ planned: -1, actual: null }])).not.toBeNull();
    expect(fundsError(100, 200)).toBeNull();
    expect(fundsError(300, 200)).not.toBeNull();
    expect(fundsError(-1, 0)).not.toBeNull();
  });
});

describe("minimum IRCC en dollars canadiens", () => {
  it("suit le taux du jour, sinon le taux enregistré, sinon garde le montant FCFA", () => {
    const d = { fundsMin: 6_000_000, fundsMinCad: 15_263, cadRate: 410 };
    expect(effectiveFundsMin(d, 416.27)).toBe(Math.round(15_263 * 416.27));
    expect(effectiveFundsMin(d, null)).toBe(15_263 * 410);
    expect(effectiveFundsMin({ ...d, fundsMinCad: null }, 416.27)).toBe(6_000_000);
  });
});
