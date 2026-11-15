import { describe, expect, it } from "vitest";
import { XOF_PER_EUR, convert, parseAmount, ratesFromEur } from "./currency";

describe("convertisseur de devises", () => {
  const rates = ratesFromEur({ CAD: 1.5758, USD: 1.1052 }, "2026-11-13", "BCE")!;

  it("déduit la valeur du dollar canadien en FCFA de la parité euro", () => {
    expect(rates.perXof.EUR).toBe(XOF_PER_EUR);
    expect(rates.perXof.CAD).toBeCloseTo(416.27, 2);
  });

  it("convertit dans les deux sens, aller-retour sans perte", () => {
    const cad = convert(250_000, "XOF", "CAD", rates.perXof);
    expect(cad).toBeCloseTo(600.57, 2);
    expect(convert(cad, "CAD", "XOF", rates.perXof)).toBeCloseTo(250_000, 6);
    expect(convert(100, "EUR", "XOF", rates.perXof)).toBeCloseTo(65_595.7, 6);
    expect(convert(100, "USD", "CAD", rates.perXof)).toBeCloseTo(142.58, 2);
    expect(convert(42, "CAD", "CAD", rates.perXof)).toBe(42);
  });

  it("lit les montants saisis à la française ou à l'anglaise", () => {
    expect(parseAmount("250 000")).toBe(250000);
    expect(parseAmount("1 234,56")).toBe(1234.56);
    expect(parseAmount("1.234,5")).toBe(1234.5);
    expect(parseAmount("1,234.5")).toBe(1234.5);
    expect(parseAmount("abc")).toBeNaN();
    expect(parseAmount("")).toBeNaN();
  });

  it("refuse des taux incomplets", () => {
    expect(ratesFromEur({ CAD: 1.5 }, "d", "s")).toBeNull();
  });
});
