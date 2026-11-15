/**
 * Contrôle de saisie des périodes (historique, adresses) : dates au format AAAA-MM ou AAAA-MM-JJ,
 * dates réelles (pas de 31 février), fin postérieure au début, pas de début dans le futur.
 * Logique pure, sans dépendance au navigateur.
 */

const DATE_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

export interface PeriodIssues {
  from?: string;
  to?: string;
}

/** Date UTC du début (ou de la fin, si `end`) de la valeur, ou null si illisible ou impossible. */
function strictDate(v: string, end: boolean): Date | null {
  const m = DATE_RE.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12) return null;
  if (m[3] === undefined) return end ? new Date(Date.UTC(y, mo, 0)) : new Date(Date.UTC(y, mo - 1, 1));
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

function formatIssue(v: string): string {
  return DATE_RE.test(v.trim()) ? "Date impossible (mois ou jour hors limites)." : "Format attendu : AAAA-MM-JJ ou AAAA-MM.";
}

/** Problèmes de saisie d'une période ; `to` vide signifie « en cours ». */
export function periodIssues(from: string, to: string, now: Date = new Date()): PeriodIssues {
  const out: PeriodIssues = {};
  const f = from.trim();
  const t = to.trim();
  const start = f ? strictDate(f, false) : null;
  const finish = t ? strictDate(t, true) : null;

  if (!f) out.from = "Date de début obligatoire.";
  else if (!start) out.from = formatIssue(f);
  else if (start.getTime() > Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) out.from = "Début dans le futur.";

  if (t && !finish) out.to = formatIssue(t);
  else if (start && finish && finish.getTime() < start.getTime()) out.to = "La fin précède le début.";

  return out;
}

/** Nombre de lignes comportant au moins un problème de saisie. */
export function countPeriodIssues(rows: Array<{ from: string; to: string }>, now: Date = new Date()): number {
  return rows.filter((r) => {
    const i = periodIssues(r.from, r.to, now);
    return Boolean(i.from || i.to);
  }).length;
}
