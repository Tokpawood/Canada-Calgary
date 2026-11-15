import type { Step } from "@/lib/types";

/** Minuscules sans accents : « Biométrie » et « biometrie » se retrouvent. */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type SearchableStep = Pick<Step, "title" | "org" | "notes" | "req" | "risk"> & { tasks: Array<{ text: string }> };

/**
 * Recherche d'étape insensible à la casse et aux accents, sur l'intitulé, l'organisme, les notes et les mini-étapes.
 * Tous les mots de la requête doivent être présents (dans n'importe quel champ).
 */
export function stepMatchesQuery(step: SearchableStep, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = foldText([step.title, step.org, step.notes, step.req, step.risk, ...step.tasks.map((t) => t.text)].join(" "));
  return words.every((w) => hay.includes(w));
}

/** Tri par échéance (sans date à la fin) ; à échéance égale, l'ordre du parcours est conservé. */
export function sortStepsByDue<T extends Pick<Step, "due" | "position">>(steps: T[]): T[] {
  const time = (d: string | null) => {
    if (!d) return Infinity;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? Infinity : t;
  };
  return [...steps].sort((a, b) => {
    const diff = time(a.due) - time(b.due);
    if (diff !== 0 && !Number.isNaN(diff)) return diff;
    return (a.position ?? 0) - (b.position ?? 0);
  });
}

/** Position à donner à une nouvelle étape : après la dernière existante (même si des étapes ont été supprimées). */
export function nextStepPosition(steps: Array<Pick<Step, "position">>): number {
  return steps.reduce((max, s) => Math.max(max, (s.position ?? -1) + 1), 0);
}

/** Montant saisi dans un champ de coût : vide → null, négatif ou invalide → null. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
