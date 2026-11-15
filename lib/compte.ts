/**
 * Dates de la page Compte, formatées dans un fuseau fixe : le rendu serveur et l'appareil
 * (iPad réglé sur Calgary) produisent exactement le même texte, sans écart d'hydratation.
 */
export const ACCOUNT_TIME_ZONE = "America/Edmonton";

/** « 15 nov. » et « 14:05 » pour la dernière connexion, ou null si la date est absente ou invalide. */
export function formatLastSignIn(iso: string | null): { day: string; time: string } | null {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("fr-FR", { timeZone: ACCOUNT_TIME_ZONE, day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("fr-FR", { timeZone: ACCOUNT_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}

/** « nov. 2026 » pour la création du compte, ou null. */
export function formatCreatedAt(iso: string | null): string | null {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { timeZone: ACCOUNT_TIME_ZONE, month: "short", year: "numeric" });
}
