/** Logique pure de l'onglet Budget. */

/** Erreur de saisie du taux enregistré (FCFA pour 1 $ CA), ou null. */
export function rateError(rate: number): string | null {
  if (!Number.isFinite(rate) || rate <= 0) return "Le taux doit être un nombre positif.";
  if (rate < 50 || rate > 5000) return "Taux improbable : vérifiez le nombre de FCFA pour 1 $ CA.";
  return null;
}

/**
 * Écart, en %, entre le taux de la banque et le taux de référence (positif : la banque fait payer le dollar plus cher).
 * null si l'un des deux taux manque.
 */
export function bankMarginPct(myRate: number, refRate: number | null | undefined): number | null {
  if (!refRate || refRate <= 0 || !(myRate > 0)) return null;
  return ((myRate - refRate) / refRate) * 100;
}

/** Somme des dépenses à venir dont l'échéance est passée (date AAAA-MM-JJ, comparée à aujourd'hui). */
export function overdueTotal(items: Array<{ due: string | null; planned: number }>, todayIso: string): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const it of items) {
    if (it.due && it.due.slice(0, 10) < todayIso) {
      count += 1;
      total += it.planned;
    }
  }
  return { count, total };
}
