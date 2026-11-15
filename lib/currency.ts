/** Devises du convertisseur et conversions à partir des taux exprimés en francs CFA. */

export const CURRENCIES = [
  { code: "XOF", label: "Franc CFA", symbol: "FCFA", decimals: 0 },
  { code: "CAD", label: "Dollar canadien", symbol: "$ CA", decimals: 2 },
  { code: "EUR", label: "Euro", symbol: "€", decimals: 2 },
  { code: "USD", label: "Dollar américain", symbol: "$ US", decimals: 2 },
] as const;
export type Currency = (typeof CURRENCIES)[number]["code"];

/** Parité fixe du franc CFA (UEMOA) : 1 € = 655,957 FCFA. */
export const XOF_PER_EUR = 655.957;

export interface Rates {
  /** Valeur d'une unité de chaque devise, en francs CFA. */
  perXof: Record<Currency, number>;
  /** Date de publication des taux (AAAA-MM-JJ). */
  date: string;
  source: string;
}

/** Taux à partir d'un tableau « 1 € = x devise » (format de la BCE). */
export function ratesFromEur(eur: Partial<Record<Currency, number>>, date: string, source: string): Rates | null {
  const cad = eur.CAD;
  const usd = eur.USD;
  if (!cad || !usd || cad <= 0 || usd <= 0) return null;
  return { perXof: { XOF: 1, EUR: XOF_PER_EUR, CAD: XOF_PER_EUR / cad, USD: XOF_PER_EUR / usd }, date, source };
}

export function convert(amount: number, from: Currency, to: Currency, perXof: Record<Currency, number>): number {
  if (from === to) return amount;
  return (amount * perXof[from]) / perXof[to];
}

export function formatAmount(n: number, code: Currency): string {
  const decimals = CURRENCIES.find((c) => c.code === code)?.decimals ?? 2;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(n);
}

/** « 250 000 », « 1 234,56 », « 1.234,5 » ou « 1,234.5 » : nombre saisi, ou NaN. */
export function parseAmount(raw: string): number {
  let s = raw.replace(/[\s  ]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    s = s.replace(dec === "," ? /\./g : /,/g, "").replace(dec, ".");
  } else if (lastComma >= 0) s = s.replace(",", ".");
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}
