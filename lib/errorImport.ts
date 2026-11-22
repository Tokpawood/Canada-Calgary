/**
 * Import de corrections collées dans le carnet d'erreurs.
 * Accepte un tableau Markdown (| Vous avez écrit | Correction | Type |) ou un tableau copié
 * depuis une page (cellules séparées par des tabulations). Colonnes : phrase fautive,
 * correction, règle (facultative). Les autres tableaux du texte collé (scores, bilans)
 * sont ignorés : seul un tableau dont l'en-tête parle de « correction » est lu.
 */

export interface ParsedCorrection {
  wrong: string;
  correct: string;
  rule: string;
}

/** Retire la mise en forme Markdown (gras, italique, code) et les espaces superflus. */
function clean(cell: string): string {
  return cell
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|[^\w])\*(?!\s)([^*]+?)\*(?=[^\w]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function cells(line: string): string[] | null {
  const t = line.trim();
  if (!t) return null;
  if (t.startsWith("|")) {
    const parts = t.replace(/^\|/, "").replace(/\|$/, "").split("|");
    return parts.map(clean);
  }
  if (t.includes("\t")) return t.split("\t").map(clean);
  return null;
}

const SEPARATOR = /^:?-{2,}:?$/;
const isSeparator = (c: string[]) => c.every((x) => !x || SEPARATOR.test(x));
/** En-tête d'un tableau de corrections : une colonne « Correction » / « Corrigé ». */
const CORRECTION_HEADER = /^(correction|corrig[ée]|forme correcte)/i;
const isCorrectionHeader = (c: string[]) => c.some((x) => CORRECTION_HEADER.test(x)) || /vous avez [ée]crit/i.test(c[0] ?? "");

function toCorrection(c: string[]): ParsedCorrection | null {
  if (c.length < 2) return null;
  const [wrong, correct, ...rest] = c;
  if (!wrong) return null;
  return { wrong, correct: correct ?? "", rule: rest.filter(Boolean).join(" · ") };
}

export function parseCorrections(text: string): ParsedCorrection[] {
  // Regroupe les lignes de tableau consécutives : un groupe = un tableau.
  const groups: string[][][] = [];
  let current: string[][] | null = null;
  for (const line of text.split(/\r?\n/)) {
    const c = cells(line);
    if (c) {
      if (!current) groups.push((current = []));
      current.push(c);
    } else current = null;
  }

  const out: ParsedCorrection[] = [];
  for (const g of groups) {
    let rows: string[][];
    if (g.length > 1 && isSeparator(g[1])) {
      // Tableau Markdown avec en-tête : lu seulement s'il s'agit d'un tableau de corrections.
      if (!isCorrectionHeader(g[0])) continue;
      rows = g.slice(2);
    } else if (isCorrectionHeader(g[0])) {
      rows = g.slice(1); // tableau copié d'une page : l'en-tête est la première ligne
    } else {
      rows = g; // lignes sans en-tête : « faute | correction | règle »
    }
    for (const r of rows) {
      if (isSeparator(r)) continue;
      const p = toCorrection(r);
      if (p) out.push(p);
    }
  }
  return out;
}

/** Clé de comparaison : une même faute recollée augmente son compteur au lieu de créer un doublon. */
export function errorKey(wrong: string): string {
  return wrong
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
