/** Logique pure de l'onglet Épargne : libellés de mois, projections et contrôles de saisie. */

export const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\.$/, "");

/** Indice (0-11) d'un nom de mois français, complet ou abrégé (« déc. », « fevrier »), ou -1. */
export function monthIndex(name: string): number {
  const n = strip(name.trim());
  if (n.length < 3) return -1;
  const plain = MONTHS_FR.map(strip);
  const exact = plain.indexOf(n);
  if (exact >= 0) return exact;
  // « juil. » / « juin » partagent « jui » : on exige un préfixe sans ambiguïté.
  const hits = plain.map((m, i) => (m.startsWith(n) ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}

/** « Novembre 2026 » → { month: 10, year: 2026 } ; null si le libellé n'est pas un mois. */
export function parseMonthLabel(label: string): { month: number; year: number } | null {
  const m = /^(\p{L}+\.?)\s+(\d{4})$/u.exec(label.trim());
  if (!m) return null;
  const month = monthIndex(m[1]);
  return month >= 0 ? { month, year: Number(m[2]) } : null;
}

/** Libellé « Novembre 2026 » d'un mois donné. */
export function monthLabel(month: number, year: number): string {
  const name = MONTHS_FR[((month % 12) + 12) % 12];
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/**
 * Libellé proposé pour un nouveau versement : le mois suivant le dernier libellé reconnu,
 * sinon le mois en cours.
 */
export function suggestNextLabel(labels: string[], today: Date = new Date()): string {
  for (let i = labels.length - 1; i >= 0; i--) {
    const p = parseMonthLabel(labels[i]);
    if (p) return p.month === 11 ? monthLabel(0, p.year + 1) : monthLabel(p.month + 1, p.year);
  }
  return monthLabel(today.getMonth(), today.getFullYear());
}

/** Mois atteint dans `months` mois à partir d'aujourd'hui, en toutes lettres (« mars 2027 »). */
export function monthsFromNow(months: number, today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() + months, 1);
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/** Erreur de saisie des versements, ou null. */
export function savingsError(rows: Array<{ planned: number | null; actual: number | null }>): string | null {
  for (const r of rows) {
    for (const v of [r.planned, r.actual]) {
      if (v != null && (!Number.isFinite(v) || v < 0)) return "Les montants doivent être des nombres positifs.";
    }
  }
  return null;
}

/** Erreur de saisie des objectifs, ou null. */
export function fundsError(fundsMin: number, fundsTarget: number): string | null {
  if (!Number.isFinite(fundsMin) || !Number.isFinite(fundsTarget) || fundsMin < 0 || fundsTarget < 0) return "Les objectifs doivent être des montants positifs.";
  if (fundsTarget > 0 && fundsMin > fundsTarget) return "La cible personnelle doit être au moins égale au minimum exigé.";
  return null;
}

/**
 * Minimum IRCC en FCFA : quand il est fixé en dollars canadiens (barème officiel), il suit le taux
 * (taux du jour, sinon taux enregistré) ; sinon on garde le montant FCFA enregistré.
 */
export function effectiveFundsMin(d: { fundsMin: number; fundsMinCad: number | null; cadRate: number }, liveCadRate: number | null | undefined): number {
  const rate = liveCadRate && liveCadRate > 0 ? liveCadRate : d.cadRate;
  if (d.fundsMinCad != null && d.fundsMinCad > 0 && rate > 0) return Math.round(d.fundsMinCad * rate);
  return d.fundsMin;
}

/** Montant prévu à reprendre pour un nouveau versement : le dernier prévu renseigné, ou null. */
export function lastPlanned(rows: Array<{ planned: number | null }>): number | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].planned != null) return rows[i].planned;
  return null;
}

/** Écart total versé moins prévu, sur les lignes où les deux montants sont renseignés (comme la colonne Écart). */
export function savingsGap(rows: Array<{ planned: number | null; actual: number | null }>): number {
  return rows.reduce((s, r) => s + (r.actual != null && r.planned != null ? r.actual - r.planned : 0), 0);
}
