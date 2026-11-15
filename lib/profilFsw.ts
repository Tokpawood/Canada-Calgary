/**
 * Contrôle de saisie de la grille de points : niveaux NCLC entiers de 0 à 12 (ou vides).
 * Logique pure, sans dépendance au navigateur.
 */
import type { FswProfile } from "./types";

const NCLC_KEYS = ["fr_co", "fr_ce", "fr_eo", "fr_ee", "en_co", "en_ce", "en_eo", "en_ee"] as const;

/** Message tant qu'un niveau saisi n'est pas un entier entre 0 et 12, sinon null. */
export function nclcIssue(fsw: Pick<FswProfile, (typeof NCLC_KEYS)[number]>): string | null {
  const bad = NCLC_KEYS.filter((k) => {
    const v = String(fsw[k] ?? "").trim();
    return v !== "" && !(/^\d{1,2}$/.test(v) && Number(v) <= 12);
  }).length;
  return bad ? `Niveau NCLC entier de 0 à 12 attendu (${bad} épreuve${bad > 1 ? "s" : ""} à corriger).` : null;
}
