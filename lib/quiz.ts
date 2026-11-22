/**
 * Exercices du jour (TCF) : schémas, contexte envoyé à Claude, correction des réponses fermées
 * et calcul des progrès. Aucune dépendance réseau ici : tout est testable.
 */
import * as z from "zod/v4";
import { ERROR_SKILLS, TCF, addDays, type ErrorEntry, type MemoEntry, type Week } from "./formation";

export const QUIZ_SIZE = 10;
export const QUIZ_KINDS = ["qcm", "trou", "correction", "reformulation", "production"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];
/** Réponses fermées : corrigées sur place, sans appel à Claude. */
export const CLOSED_KINDS: QuizKind[] = ["qcm", "trou"];
export const QUIZ_SOURCES = ["carnet", "aide-memoire", "cours"] as const;
export type QuizSource = (typeof QUIZ_SOURCES)[number];

export const KIND_LABEL: Record<QuizKind, string> = {
  qcm: "Choix multiple",
  trou: "Texte à trous",
  correction: "Corriger la phrase",
  reformulation: "Reformuler au niveau C1",
  production: "Écrire",
};
export const SOURCE_LABEL: Record<QuizSource, string> = { carnet: "Carnet d'erreurs", "aide-memoire": "Aide-mémoire", cours: "Cours de la semaine" };

/** Série renvoyée par Claude (sortie structurée). */
export const QuizItemSchema = z.object({
  kind: z.enum(QUIZ_KINDS),
  skill: z.enum(ERROR_SKILLS.tcf as [string, ...string[]]),
  source: z.enum(QUIZ_SOURCES),
  /** Identifiant de l'erreur du carnet ciblée, ou chaîne vide. */
  error_id: z.string(),
  /** Règle ou notion testée, en quelques mots. */
  topic: z.string(),
  instruction: z.string(),
  prompt: z.string(),
  /** Propositions du QCM (vide pour les autres types). */
  options: z.array(z.string()),
  /** Réponses acceptées pour qcm et trou ; pour les autres, une réponse modèle. */
  accepted: z.array(z.string()),
  explanation: z.string(),
});
export const QuizSchema = z.object({
  title: z.string(),
  focus: z.string(),
  items: z.array(QuizItemSchema),
});
export type QuizItemAI = z.infer<typeof QuizItemSchema>;

export interface QuizItem extends QuizItemAI {
  id: string;
}

/** Ce que le navigateur reçoit avant correction : pas de réponses attendues ni d'explications. */
export type PublicQuizItem = Omit<QuizItem, "accepted" | "explanation"> & { accepted?: string[]; explanation?: string };

export interface ItemResult {
  id: string;
  /** 0, 0.5 ou 1. */
  score: number;
  feedback: string;
  /** Version corrigée proposée (réponses ouvertes). */
  corrected: string;
}

export const GradeSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.enum(["0", "0.5", "1"]),
      feedback: z.string(),
      corrected: z.string(),
    }),
  ),
  summary: z.string(),
});

export interface Quiz {
  id: string;
  day: string;
  title: string;
  focus: string;
  items: PublicQuizItem[];
  answers: Record<string, string> | null;
  results: ItemResult[] | null;
  summary: string;
  score: number | null;
  total: number;
  status: "pret" | "corrige";
}

// ---------------------------------------------------------------------------
// Correction locale des réponses fermées

/** Compare deux réponses en gardant les accents (à ≠ a) mais en ignorant casse, espaces et apostrophes typographiques. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[«»"“”]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([',/])\s*/g, "$1")
    .replace(/[\s.;!?]+$/g, "")
    .trim();
}

export function gradeClosed(item: QuizItem, answer: string): ItemResult {
  const given = normalizeAnswer(answer);
  const ok = given.length > 0 && item.accepted.some((a) => normalizeAnswer(a) === given);
  return {
    id: item.id,
    score: ok ? 1 : 0,
    feedback: ok ? "Juste." : given ? `Attendu : ${item.accepted[0] ?? "—"}.` : "Pas de réponse.",
    corrected: item.accepted[0] ?? "",
  };
}

export function scoreOf(results: ItemResult[]): number {
  return Math.round(results.reduce((s, r) => s + r.score, 0) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Contexte envoyé à Claude

/** Semaines du programme TCF déjà commencées au jour donné (la plus récente en dernier). */
export function weeksSoFar(today: string): Week[] {
  return TCF.weeks.filter((w) => w.from <= today);
}

export interface QuizHistoryEntry {
  day: string;
  score: number | null;
  total: number;
  items: Array<Pick<QuizItem, "id" | "topic" | "skill" | "error_id" | "prompt">>;
  results: ItemResult[] | null;
}

export const QUIZ_SYSTEM = `Tu es le coach TCF Canada d'un candidat francophone (Côte d'Ivoire) qui vise NCLC 10 (16/20 en expression écrite et orale, 549 en compréhension). Chaque jour, tu prépares une courte série d'exercices pour vérifier qu'il a retenu ce qu'il a appris et pour mesurer ses progrès d'un jour à l'autre.

Ce que tu reçois : son carnet d'erreurs (fautes réelles, avec le nombre de fois où elles sont revenues), son aide-mémoire (leçons de synthèse de son correcteur), le programme des semaines déjà commencées (thème, grammaire, épreuve à renforcer) et les résultats de ses dernières séries.

Comment construire la série :
- ${QUIZ_SIZE} exercices, du plus simple au plus exigeant, réalisables en 15 minutes environ.
- Répartition : environ 4 exercices tirés du carnet, 3 de l'aide-mémoire, 3 du cours des semaines en cours. Si une source est vide, répartis sur les autres.
- Priorité dans le carnet : les erreurs non maîtrisées revenues plusieurs fois, puis celles ratées dans les séries récentes. Une erreur réussie deux jours de suite peut attendre.
- Teste la règle, pas la mémoire de la phrase : place-la dans un contexte nouveau et crédible (vie à Calgary, démarches, travail, lieux publics, actualité). Ne recopie jamais la phrase fautive du carnet telle quelle.
- Varie les types : qcm, trou, correction, reformulation, production. Au plus 2 production.
- Ne répète pas un énoncé des séries récentes.

Règles par type :
- qcm : 3 ou 4 propositions dans "options" ; "accepted" contient exactement la bonne proposition, recopiée à l'identique.
- trou : l'énoncé contient "___" (un seul blanc, ou plusieurs remplis d'une seule réponse comme « à / chez ») ; "accepted" liste toutes les réponses justes, sans ambiguïté possible.
- correction : une phrase avec une ou deux fautes du type ciblé ; "accepted" contient la phrase corrigée.
- reformulation : une phrase de niveau B1 à hisser au niveau C1 ; "accepted" contient une reformulation modèle.
- production : 2 ou 3 phrases à écrire avec une contrainte précise (ex. placer « chez » + enseigne et un conditionnel) ; "accepted" contient un exemple de réponse.
- "options" est vide sauf pour qcm.
- "error_id" : l'identifiant exact de l'erreur du carnet ciblée, sinon chaîne vide.
- "skill" : l'épreuve concernée parmi la liste fournie.
- "topic" : la règle testée en quelques mots (ex. « chez + enseigne », « accord de public »).
- "instruction" : la consigne, courte, au vouvoiement.
- "explanation" : la règle en une ou deux phrases, affichée après correction.
- "title" : un titre court pour la série ; "focus" : une phrase qui dit ce que la série vérifie aujourd'hui.

Tout est en français correct, sans faute.`;

export function buildQuizContext(opts: { today: string; errors: ErrorEntry[]; memos: MemoEntry[]; history: QuizHistoryEntry[] }): string {
  const weeks = weeksSoFar(opts.today);
  const current = weeks[weeks.length - 1];
  const phase = TCF.phases.find((p) => p.from <= opts.today && p.to >= opts.today);

  const errors = opts.errors
    .filter((e) => e.exam === "tcf")
    .sort((a, b) => Number(a.mastered) - Number(b.mastered) || b.count - a.count)
    .slice(0, 60)
    .map((e) => `- [${e.id}] (${e.skill}${e.mastered ? ", maîtrisée" : ""}, ${e.count} fois) « ${e.wrong} » → « ${e.correct} »${e.rule ? ` — ${e.rule}` : ""}`);

  const memos = opts.memos
    .filter((m) => m.exam === "tcf")
    .slice(0, 8)
    .map((m) => `### ${m.title}\n${m.body}`);

  const recent = opts.history.slice(0, 7).map((h) => {
    const res = new Map((h.results ?? []).map((r) => [r.id, r.score]));
    const lines = [`- ${h.day} : ${h.score == null ? "non corrigée" : `${h.score}/${h.total}`}`];
    for (const it of h.items) {
      const s = res.get(it.id);
      const mark = s == null ? "" : s === 1 ? " ✓ réussi" : s === 0.5 ? " ½ partiel" : " ✗ raté";
      lines.push(`  · ${it.topic}${it.error_id ? ` [${it.error_id}]` : ""}${mark} : ${it.prompt.slice(0, 120)}`);
    }
    return lines.join("\n");
  });

  const weekLines = weeks.map((w) => `- Semaine ${w.n} (${w.from} → ${w.to}) : thème « ${w.theme} » ; grammaire : ${w.grammar ?? "—"} ; ${w.focus.map((f) => `${f.label} : ${f.value}`).join(" ; ")} ; objectif : ${w.goal}`);

  return [
    `Date du jour : ${opts.today}. Examen TCF Canada le ${TCF.exam}.`,
    phase ? `Phase en cours : ${phase.name} — ${phase.goal}.` : "",
    current ? `Semaine en cours : ${current.n}, thème « ${current.theme} », grammaire « ${current.grammar ?? "—"} ».` : "",
    `Épreuves possibles pour "skill" : ${ERROR_SKILLS.tcf.join(", ")}.`,
    "",
    `## Carnet d'erreurs (${errors.length})`,
    errors.length ? errors.join("\n") : "(vide)",
    "",
    `## Aide-mémoire (${memos.length} leçon${memos.length > 1 ? "s" : ""})`,
    memos.length ? memos.join("\n\n") : "(vide)",
    "",
    "## Cours des semaines commencées",
    weekLines.length ? weekLines.join("\n") : "(le programme n'a pas commencé)",
    "",
    "## Séries récentes (la plus récente d'abord)",
    recent.length ? recent.join("\n") : "(aucune : c'est la première série)",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export const GRADE_SYSTEM = `Tu corriges les réponses ouvertes d'un candidat au TCF Canada qui vise NCLC 10. Pour chaque exercice : 1 si la réponse respecte la consigne et ne contient aucune faute sur la règle testée ni ailleurs ; 0.5 si la règle testée est juste mais qu'il reste une autre faute, ou si la consigne est en partie respectée ; 0 sinon (ou pas de réponse). Une réponse peut être juste sans ressembler à la réponse modèle. "feedback" : une ou deux phrases au vouvoiement, qui nomment la faute précise et la règle. "corrected" : la réponse du candidat corrigée au plus près de ce qu'il a écrit (ou la réponse modèle s'il n'a rien écrit). "summary" : deux phrases sur ce qui est acquis et ce qui reste à revoir. Tout en français correct.`;

export function buildGradeContext(items: QuizItem[], answers: Record<string, string>): string {
  return items
    .map(
      (it) =>
        `### Exercice ${it.id} (${KIND_LABEL[it.kind]} — règle : ${it.topic})\nConsigne : ${it.instruction}\nÉnoncé : ${it.prompt}\nRéponse modèle : ${it.accepted[0] ?? "—"}\nRéponse du candidat : ${(answers[it.id] ?? "").trim() || "(pas de réponse)"}`,
    )
    .join("\n\n");
}

/** Numérote les exercices renvoyés par Claude et nettoie les champs incohérents. */
export function finalizeItems(raw: QuizItemAI[]): QuizItem[] {
  return raw.slice(0, QUIZ_SIZE + 2).map((it, i) => ({
    ...it,
    id: `e${i + 1}`,
    options: it.kind === "qcm" ? it.options.slice(0, 5) : [],
    accepted: it.accepted.filter((a) => a.trim()).slice(0, 8),
  }));
}

export function toPublic(items: QuizItem[], reveal: boolean): PublicQuizItem[] {
  return items.map((it) => {
    if (reveal) return it;
    const { accepted: _a, explanation: _e, ...rest } = it;
    void _a;
    void _e;
    return rest;
  });
}

// ---------------------------------------------------------------------------
// Progrès

export interface Progress {
  done: number;
  average: number | null;
  last7: number | null;
  prev7: number | null;
  bySkill: Array<{ skill: string; rate: number; n: number }>;
  byTopic: Array<{ topic: string; rate: number; n: number }>;
}

export function progressOf(quizzes: Array<Pick<Quiz, "day" | "score" | "total" | "items" | "results">>, today: string): Progress {
  const done = quizzes.filter((q) => q.score != null && q.results);
  const pct = (q: (typeof done)[number]) => (q.score! / q.total) * 100;
  const avg = (list: typeof done) => (list.length ? Math.round(list.reduce((s, q) => s + pct(q), 0) / list.length) : null);
  const since = (d: number) => addDays(today, -d);
  const skill = new Map<string, { s: number; n: number }>();
  const topic = new Map<string, { s: number; n: number }>();
  for (const q of done) {
    for (const r of q.results!) {
      const it = q.items.find((x) => x.id === r.id);
      if (!it) continue;
      for (const [map, key] of [
        [skill, it.skill],
        [topic, it.topic.toLowerCase()],
      ] as const) {
        const cur = map.get(key) ?? { s: 0, n: 0 };
        map.set(key, { s: cur.s + r.score, n: cur.n + 1 });
      }
    }
  }
  const rows = (m: Map<string, { s: number; n: number }>) =>
    [...m.entries()].map(([k, v]) => ({ key: k, rate: Math.round((v.s / v.n) * 100), n: v.n })).sort((a, b) => a.rate - b.rate || b.n - a.n);
  return {
    done: done.length,
    average: avg(done),
    last7: avg(done.filter((q) => q.day > since(7))),
    prev7: avg(done.filter((q) => q.day <= since(7) && q.day > since(14))),
    bySkill: rows(skill).map(({ key, ...r }) => ({ skill: key, ...r })),
    byTopic: rows(topic).map(({ key, ...r }) => ({ topic: key, ...r })),
  };
}

// ---------------------------------------------------------------------------
// Lignes de la base → objets de l'interface

export interface QuizRow {
  id: string;
  day: string;
  title: string | null;
  focus: string | null;
  items: QuizItem[];
  answers: Record<string, string> | null;
  results: { items: ItemResult[]; summary: string } | null;
  score: number | string | null;
  total: number;
  status: "pret" | "corrige";
}

export function mapQuizRow(r: QuizRow): Quiz {
  const corrected = r.status === "corrige";
  return {
    id: r.id,
    day: r.day,
    title: r.title ?? "",
    focus: r.focus ?? "",
    items: toPublic(r.items ?? [], corrected),
    answers: r.answers,
    results: r.results?.items ?? null,
    summary: r.results?.summary ?? "",
    score: r.score == null ? null : Number(r.score),
    total: r.total,
    status: r.status,
  };
}
