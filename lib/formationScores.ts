/**
 * Saisie et comparaison des scores d'entraînement (TCF Canada, IELTS General Training).
 * Logique pure, sans entrée/sortie : testable.
 */
import { SKILLS, type Lang } from "./formation";

export type ParsedScores = { ok: true; scores: Array<number | null> } | { ok: false; error: string };

/**
 * Convertit les 4 champs saisis (virgule ou point décimal) en notes.
 * TCF : notes entières (CO/CE sur 699, EE/EO sur 20). IELTS : bandes par demi-point de 0 à 9.
 * Au moins une note est exigée ; un champ vide reste « non noté ».
 */
export function parseScores(exam: Lang, raw: string[]): ParsedScores {
  const skills = SKILLS[exam];
  const scores: Array<number | null> = [];
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const txt = (raw[i] ?? "").trim().replace(/\s/g, "").replace(",", ".");
    if (txt === "") {
      scores.push(null);
      continue;
    }
    const n = Number(txt);
    if (!/^\d+(\.\d+)?$/.test(txt) || Number.isNaN(n) || n < 0 || n > s.max) {
      return { ok: false, error: `${s.name} : note entre 0 et ${s.max}.` };
    }
    if (exam === "ielts" && !Number.isInteger(n * 2)) {
      return { ok: false, error: `${s.name} : les bandes IELTS vont par demi-point (6, 6,5, 7…).` };
    }
    if (exam === "tcf" && !Number.isInteger(n)) {
      return { ok: false, error: `${s.name} : note entière attendue.` };
    }
    scores.push(n);
  }
  if (scores.every((v) => v == null)) return { ok: false, error: "Saisissez au moins une note." };
  return { ok: true, scores };
}

/**
 * Écart de chaque compétence avec le test précédent qui la notait (lignes déjà triées par date).
 * null quand il n'y a rien à comparer.
 */
export function scoreDeltas(sorted: Array<{ scores: Array<number | null> }>): Array<Array<number | null>> {
  const last: Array<number | null> = [null, null, null, null];
  return sorted.map((r) =>
    r.scores.map((v, i) => {
      const prev = last[i];
      if (v == null) return null;
      last[i] = v;
      return prev == null ? null : Math.round((v - prev) * 10) / 10;
    }),
  );
}

/** « +12 », « −0,5 », « = » : écart lisible en français. */
export function fmtDelta(d: number): string {
  if (d === 0) return "=";
  const abs = String(Math.abs(d)).replace(".", ",");
  return d > 0 ? `+${abs}` : `−${abs}`;
}
