import "server-only";
import { ratesFromEur, type Rates } from "./currency";

/**
 * Taux du jour de la Banque centrale européenne (publiés chaque jour ouvré vers 16 h, heure de Francfort),
 * via frankfurter.dev, sans clé. Remis en cache une heure ; null si le service ne répond pas.
 */
export async function getDailyRates(): Promise<Rates | null> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CAD,USD", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
    if (!json.rates || !json.date) return null;
    return ratesFromEur({ CAD: json.rates.CAD, USD: json.rates.USD }, json.date, "Banque centrale européenne");
  } catch {
    return null;
  }
}
