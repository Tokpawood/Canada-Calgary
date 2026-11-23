/**
 * Tests TCF Canada en conditions réelles : formats officiels, rotation quotidienne, plan adaptatif
 * (du niveau actuel vers C2), estimation des scores et consignes envoyées à Claude.
 */
import * as z from "zod/v4";
import { TCF_GOAL, TCF_LAST_NEW, TCF_ROTATION, addDays, weekOf, type ErrorEntry, type Week } from "./formation";

// ---------------------------------------------------------------------------
// Niveaux et barèmes

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];
export const EPREUVES = ["co", "ce", "ee", "eo"] as const;
export type Epreuve = (typeof EPREUVES)[number];
export const EPREUVE_LABEL: Record<Epreuve, string> = {
  co: "Compréhension orale",
  ce: "Compréhension écrite",
  ee: "Expression écrite",
  eo: "Expression orale",
};
export const EPREUVE_SHORT: Record<Epreuve, string> = {
  co: "CO",
  ce: "CE",
  ee: "EE",
  eo: "EO",
};
export const isComprehension = (e: Epreuve) => e === "co" || e === "ce";

/** Épreuves officielles du TCF Canada. */
export const OFFICIAL = {
  co: { count: 39, minutes: 35 },
  ce: { count: 39, minutes: 60 },
  ee: { tasks: [1, 2, 3], minutes: 60 },
  eo: { tasks: [1, 2, 3], minutes: 12 },
} as const;
export const EE_TASK_MINUTES: Record<number, number> = { 1: 15, 2: 20, 3: 25 };
export const EE_WORDS: Record<number, [number, number]> = {
  1: [60, 120],
  2: [120, 150],
  3: [120, 180],
};
/** Préparation et prise de parole (secondes) des trois tâches d'expression orale. */
export const EO_TIMING: Record<number, { prep: number; speak: number }> = {
  1: { prep: 0, speak: 120 },
  2: { prep: 120, speak: 330 },
  3: { prep: 0, speak: 270 },
};

/** Compréhension : score sur 699 → niveau du CECR. */
export function levelFromScore(score: number): Level {
  return LEVELS[Math.max(0, Math.min(5, Math.floor((score - 100) / 100)))];
}
/** Expression : note sur 20 → niveau du CECR (barème TCF). */
export function levelFromNote(note: number): Level {
  if (note >= 16) return "C2";
  if (note >= 14) return "C1";
  if (note >= 10) return "B2";
  if (note >= 6) return "B1";
  if (note >= 4) return "A2";
  return "A1";
}
const NCLC_TABLES: Record<Epreuve, Array<[number, number]>> = {
  co: [
    [549, 10],
    [523, 9],
    [503, 8],
    [458, 7],
    [398, 6],
    [369, 5],
    [331, 4],
  ],
  ce: [
    [549, 10],
    [524, 9],
    [499, 8],
    [453, 7],
    [406, 6],
    [375, 5],
    [342, 4],
  ],
  ee: [
    [16, 10],
    [14, 9],
    [12, 8],
    [10, 7],
    [7, 6],
    [6, 5],
    [4, 4],
  ],
  eo: [
    [16, 10],
    [14, 9],
    [12, 8],
    [10, 7],
    [7, 6],
    [6, 5],
    [4, 4],
  ],
};
/** Niveau NCLC (Canada) ; 3 = inférieur à NCLC 4. */
export function nclcOf(e: Epreuve, value: number): number {
  for (const [min, n] of NCLC_TABLES[e]) if (value >= min) return n;
  return 3;
}
/** Cible d'entraînement (C2) et cible d'examen (NCLC 10), communes à toute la formation TCF Canada. */
export const C2_TARGET: Record<Epreuve, number> = {
  co: TCF_GOAL.training.comprehension,
  ce: TCF_GOAL.training.comprehension,
  ee: TCF_GOAL.training.expression,
  eo: TCF_GOAL.training.expression,
};
export const EXAM_TARGET: Record<Epreuve, number> = {
  co: TCF_GOAL.exam.comprehension,
  ce: TCF_GOAL.exam.comprehension,
  ee: TCF_GOAL.exam.expression,
  eo: TCF_GOAL.exam.expression,
};
export const MAX_VALUE: Record<Epreuve, number> = {
  co: 699,
  ce: 699,
  ee: 20,
  eo: 20,
};
export const levelOf = (e: Epreuve, v: number) =>
  isComprehension(e) ? levelFromScore(v) : levelFromNote(v);

/**
 * Estimation du score de compréhension (100–699) à partir des réponses, selon un modèle de Rasch simple :
 * chaque niveau a une difficulté (A1 = 0,5 … C2 = 5,5, en centaines de points) et on retient l'aptitude
 * la plus vraisemblable, légèrement tirée vers l'estimation précédente quand les questions sont peu nombreuses.
 */
export function estimateScore(
  answers: Array<{ level: Level; correct: boolean }>,
  prior = 350,
): number {
  if (!answers.length) return Math.round(prior);
  const k = 2.2;
  const p0 = (prior - 100) / 100;
  let best = 0;
  let bestLL = -Infinity;
  for (let t = 0; t <= 6.0001; t += 0.01) {
    let ll = -((t - p0) ** 2) / (2 * 1.5 ** 2);
    for (const a of answers) {
      const b = LEVELS.indexOf(a.level) + 0.5;
      const p = 1 / (1 + Math.exp(-k * (t - b)));
      ll += a.correct ? Math.log(p) : Math.log(1 - p);
    }
    if (ll > bestLL) {
      bestLL = ll;
      best = t;
    }
  }
  return Math.max(100, Math.min(699, Math.round(100 + best * 100)));
}

// ---------------------------------------------------------------------------
// Plan des tests

export interface Section {
  epreuve: Epreuve;
  minutes: number;
  /** Compréhension : niveau visé de chaque question, du plus facile au plus difficile. */
  levels?: Level[];
  /** Expression : tâches officielles proposées. */
  tasks?: number[];
  /** Morceaux préparés séparément : indices globaux et plage de questions. */
  parts: Array<{ idx: number; from: number; to: number }>;
}
export interface Plan {
  sections: Section[];
  /** Recherche de documents en cours depuis cette date (absente une fois terminée). */
  researching_since?: string;
  /** Jour où les notes de recherche ont été cherchées (réutilisées quelques jours). */
  research_day?: string;
}
/** Au-delà, une recherche jamais terminée (serveur interrompu) est relancée. */
export const RESEARCH_STALE_MS = 5 * 60_000;
export type TestKind = "positionnement" | "quotidien" | "blanc";
export type Estimates = Partial<Record<Epreuve, number>>;

export const PART_SIZE = 5;
const OFFICIAL_SPREAD = [4, 6, 9, 9, 6, 5]; // 39 questions de A1 à C2
const PLACEMENT_SPREAD = [2, 2, 3, 3, 3, 2]; // 15 questions

function spread(counts: number[]): Level[] {
  return counts.flatMap((n, i) => Array<Level>(n).fill(LEVELS[i]));
}

/** Niveaux visés pour un test adaptatif : autour du niveau actuel, avec une part au-dessus pour tirer vers C2. */
export function adaptiveLevels(
  count: number,
  score: number | undefined,
): Level[] {
  const cur = score == null ? 2 : LEVELS.indexOf(levelFromScore(score));
  const weights: Array<[number, number]> =
    cur >= 5
      ? [
          [-1, 0.3],
          [0, 0.7],
        ]
      : cur === 4
        ? [
            [-1, 0.2],
            [0, 0.45],
            [1, 0.35],
          ]
        : [
            [-1, 0.2],
            [0, 0.4],
            [1, 0.3],
            [2, 0.1],
          ];
  const out: Level[] = [];
  let left = count;
  weights.forEach(([d, w], i) => {
    const n = i === weights.length - 1 ? left : Math.round(count * w);
    left -= n;
    out.push(
      ...Array<Level>(Math.max(0, n)).fill(
        LEVELS[Math.max(0, Math.min(5, cur + d))],
      ),
    );
  });
  return out.sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));
}

/** Rotation de la semaine (0 = dimanche), tirée du programme de formation. */
export const ROTATION: Record<number, { label: string; epreuves: Epreuve[] }> = {
  1: { label: "Compréhension orale", epreuves: TCF_ROTATION[1] },
  2: { label: "Compréhension écrite", epreuves: TCF_ROTATION[2] },
  3: { label: "Expression écrite", epreuves: TCF_ROTATION[3] },
  4: { label: "Expression orale + écoute", epreuves: TCF_ROTATION[4] },
  5: { label: "Mixte : lecture, écoute, écrit", epreuves: TCF_ROTATION[5] },
  6: { label: "Examen blanc", epreuves: [] },
  0: { label: "Point faible", epreuves: [] },
};

export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}
function weekNumber(day: string): number {
  return Math.floor(new Date(`${day}T12:00:00Z`).getTime() / (7 * 86_400_000));
}

/** Semaine du cours TCF Canada en cours, s'il reste du nouveau à apprendre. */
export function tcfWeek(day: string): Week | null {
  const w = weekOf(day);
  return w && w.prog === "tcf" && day <= TCF_LAST_NEW ? w : null;
}

/** Type du test du jour : positionnement d'abord, examen blanc les samedis prévus par le programme. */
export function kindFor(day: string, placed: boolean): TestKind {
  if (!placed) return "positionnement";
  return weekdayOf(day) === 6 && tcfWeek(day)?.saturday?.mock ? "blanc" : "quotidien";
}

/**
 * Plan du test du jour (sans numérotation des morceaux), calé sur le programme : rotation des épreuves,
 * examens blancs du samedi, semaines allégées. null quand le programme ne prévoit plus de test.
 */
export function planFor(kind: TestKind, day: string, est: Estimates): { title: string; sections: Array<Omit<Section, "parts">> } | null {
  if (kind === "positionnement")
    return {
      title: "Positionnement TCF Canada",
      sections: [
        { epreuve: "co", minutes: 15, levels: spread(PLACEMENT_SPREAD) },
        { epreuve: "ce", minutes: 25, levels: spread(PLACEMENT_SPREAD) },
        { epreuve: "ee", minutes: 20, tasks: [2] },
      ],
    };
  const week = tcfWeek(day);
  if (!week) return null;
  if (kind === "blanc")
    return {
      title: week.saturday?.mock ? week.saturday.label.replace(/^Examen blanc/, "TCF Canada blanc") : "TCF Canada blanc complet",
      sections: [
        { epreuve: "co", minutes: OFFICIAL.co.minutes, levels: spread(OFFICIAL_SPREAD) },
        { epreuve: "ce", minutes: OFFICIAL.ce.minutes, levels: spread(OFFICIAL_SPREAD) },
        { epreuve: "ee", minutes: OFFICIAL.ee.minutes, tasks: [1, 2, 3] },
        { epreuve: "eo", minutes: OFFICIAL.eo.minutes, tasks: [1, 2, 3] },
      ],
    };
  // Semaines allégées du programme (fêtes, dernière semaine) : tests raccourcis.
  const n = week.n === 6 || week.n === 13 ? 10 : 20;
  const eeTasks = weekNumber(day) % 2 ? [1, 3] : [2, 3];
  const co = (k: number) => ({ epreuve: "co" as const, minutes: Math.round((k * OFFICIAL.co.minutes) / OFFICIAL.co.count), levels: adaptiveLevels(k, est.co) });
  const ce = (k: number) => ({ epreuve: "ce" as const, minutes: Math.round((k * OFFICIAL.ce.minutes) / OFFICIAL.ce.count), levels: adaptiveLevels(k, est.ce) });
  const ee = (tasks: number[]) => ({ epreuve: "ee" as const, minutes: tasks.reduce((sum, t) => sum + EE_TASK_MINUTES[t], 0), tasks });
  // Compréhension la plus éloignée de l'objectif (à égalité, l'oral).
  const weak: Epreuve = (est.co ?? 0) <= (est.ce ?? 0) ? "co" : "ce";
  switch (weekdayOf(day)) {
    case 1:
      return { title: "Compréhension orale", sections: [co(n)] };
    case 2:
      return { title: "Compréhension écrite", sections: [ce(n)] };
    case 3:
      return { title: "Expression écrite", sections: [ee(week.n === 13 ? [3] : eeTasks)] };
    case 4:
      return { title: "Expression orale et écoute", sections: [{ epreuve: "eo", minutes: OFFICIAL.eo.minutes, tasks: [1, 2, 3] }, co(10)] };
    case 5:
      return { title: "Mixte : lecture, écoute et écrit", sections: [ce(10), co(10), ee([3])] };
    case 6:
      // Samedi d'entraînement du programme : une épreuve de compréhension complète et une tâche 3.
      return {
        title: `Entraînement du samedi : ${EPREUVE_LABEL[weak].toLowerCase()} et tâche 3`,
        sections: [weak === "co" ? { epreuve: "co", minutes: OFFICIAL.co.minutes, levels: adaptiveLevels(OFFICIAL.co.count, est.co) } : { epreuve: "ce", minutes: OFFICIAL.ce.minutes, levels: adaptiveLevels(OFFICIAL.ce.count, est.ce) }, ee([3])],
      };
    default:
      return { title: `Point faible : ${EPREUVE_LABEL[weak].toLowerCase()}`, sections: [weak === "co" ? co(n) : ce(n)] };
  }
}

/** Ajoute le découpage en morceaux préparés en parallèle. */
export function withParts(sections: Array<Omit<Section, "parts">>): Plan {
  let idx = 0;
  return {
    sections: sections.map((s) => {
      if (s.levels) {
        const parts = [];
        for (let from = 0; from < s.levels.length; from += PART_SIZE)
          parts.push({
            idx: idx++,
            from,
            to: Math.min(s.levels.length, from + PART_SIZE),
          });
        return { ...s, parts };
      }
      return {
        ...s,
        parts: [{ idx: idx++, from: 0, to: s.tasks?.length ?? 0 }],
      };
    }),
  };
}

export function partSpec(
  plan: Plan,
  idx: number,
): { section: Section; si: number; part: Section["parts"][number] } | null {
  for (const [si, section] of plan.sections.entries()) {
    const part = section.parts.find((p) => p.idx === idx);
    if (part) return { section, si, part };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Contenu généré par Claude

const LevelEnum = z.enum(LEVELS);
const Letter = z.enum(["A", "B", "C", "D"]);

export const CoItemSchema = z.object({
  level: LevelEnum,
  type: z
    .string()
    .describe(
      "Type de document : message de répondeur, annonce, dialogue, interview, reportage, chronique, débat…",
    ),
  context: z
    .string()
    .describe(
      "Phrase d'introduction lue avant le document, ex. « Vous entendez un message sur un répondeur. »",
    ),
  turns: z
    .array(
      z.object({
        speaker: z.string(),
        voice: z.enum(["f", "m"]),
        text: z.string(),
      }),
    )
    .describe("Le document sonore, réplique par réplique"),
  question: z.string(),
  options: z.array(z.string()).describe("Exactement 4 propositions"),
  answer: Letter,
  explanation: z
    .string()
    .describe(
      "Pourquoi la bonne réponse est juste et pourquoi chaque autre est fausse",
    ),
  focus: z
    .string()
    .describe(
      "Compétence visée : idée principale, détail, intention, implicite, registre…",
    ),
});
export const CeItemSchema = z.object({
  level: LevelEnum,
  type: z
    .string()
    .describe(
      "Type de document : annonce, courriel, article, éditorial, texte littéraire, essai…",
    ),
  context: z.string(),
  title: z.string(),
  text: z.string(),
  question: z.string(),
  options: z.array(z.string()).describe("Exactement 4 propositions"),
  answer: Letter,
  explanation: z.string(),
  focus: z.string(),
});
export const EeTaskSchema = z.object({
  task: z.enum(["1", "2", "3"]),
  consigne: z.string(),
  documents: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .describe(
      "Tâche 3 : deux documents aux points de vue opposés ; sinon vide",
    ),
});
export const EoTaskSchema = z.object({
  task: z.enum(["1", "2", "3"]),
  consigne: z.string(),
  relances: z
    .array(z.string())
    .describe(
      "Questions de l'examinateur, posées une à une pendant la prise de parole",
    ),
  role: z
    .string()
    .describe(
      "Tâche 2 : ce que sait l'examinateur (informations à obtenir) ; sinon vide",
    ),
});
export const CoPartSchema = z.object({ items: z.array(CoItemSchema) });
export const CePartSchema = z.object({ items: z.array(CeItemSchema) });
export const EePartSchema = z.object({ tasks: z.array(EeTaskSchema) });
export const EoPartSchema = z.object({ tasks: z.array(EoTaskSchema) });

export type CoItem = z.infer<typeof CoItemSchema> & { id: string };
export type CeItem = z.infer<typeof CeItemSchema> & { id: string };
export type EeTask = z.infer<typeof EeTaskSchema>;
export type EoTask = z.infer<typeof EoTaskSchema>;
export type PartContent =
  { items: Array<CoItem | CeItem> } | { tasks: Array<EeTask | EoTask> };

/** Remet les questions en forme : identifiants stables, 4 propositions, bonne réponse cohérente. */
export function finalizeQuestions<
  T extends z.infer<typeof CoItemSchema> | z.infer<typeof CeItemSchema>,
>(
  items: T[],
  epreuve: Epreuve,
  from: number,
  levels: Level[],
): Array<T & { id: string }> {
  return items
    .filter((it) => it.options.length >= 2)
    .slice(0, levels.length)
    .map((it, i) => {
      const options = it.options
        .slice(0, 4)
        .map((o) => o.trim().replace(/^[A-D][).:-]\s*/, ""));
      const answer =
        "ABCD".indexOf(it.answer) < options.length ? it.answer : "A";
      return {
        ...it,
        options,
        answer,
        level: levels[i] ?? it.level,
        id: `${epreuve}-${from + i + 1}`,
      };
    });
}

// ---------------------------------------------------------------------------
// Consignes pour Claude

export const RESEARCH_SYSTEM = `Tu prépares la matière d'un test TCF Canada (examen de français pour l'immigration au Canada).
Cherche sur internet des documents AUTHENTIQUES et RÉCENTS en français, puis rédige des notes de travail.

Varie les genres et les sources : actualité canadienne et francophone (Radio-Canada, Le Devoir, La Presse, RFI, TV5Monde, Le Monde…), vie pratique et services au Canada (gouvernement du Canada, Alberta, municipalités, santé, logement, travail), société, environnement, sciences, culture, économie, éducation, ainsi que des chroniques ou éditoriaux argumentés. Cherche aussi les thèmes qui reviennent dans les sujets d'expression écrite et orale du TCF Canada.

Rends des notes en texte simple (pas de tableau), au plus 1 200 mots :
- 8 à 10 documents, en 3 recherches au plus : chaque recherche doit viser large. Pour chacun : titre, source, date, adresse web, résumé factuel en 4 à 6 phrases (faits, chiffres, acteurs, positions en présence), 6 à 10 mots ou expressions de registre soutenu, et un angle de débat.
- 4 sujets d'actualité qui se prêtent à l'expression écrite ou orale, avec deux points de vue opposés.
Ne recopie pas les articles : résume avec tes mots.`;

export const TCF_SYSTEM = `Tu es concepteur d'épreuves du TCF Canada (France Éducation international) et formateur en français langue étrangère.
Tu rédiges des questions ORIGINALES, au format exact de l'examen, pour un candidat francophone d'Afrique de l'Ouest qui s'installe à Calgary et vise le niveau C2.

Règles générales
- Français impeccable, typographie française. Contextes crédibles : Canada (Alberta, Québec, Ontario…), francophonie, vie quotidienne, travail, société, culture, sciences.
- Inspire-toi des notes de recherche fournies (documents authentiques et récents) pour les faits et les thèmes, mais RÉDIGE TOI-MÊME chaque document : aucune phrase recopiée d'un article, aucune reprise d'annales officielles ou d'exercices publiés.
- Respecte strictement le niveau demandé pour chaque question, dans l'ordre donné.

Compréhension écrite et orale : questions à choix multiple
- 4 propositions, une seule juste, de longueur et de forme comparables ; distracteurs plausibles qui reprennent des mots du document, jamais absurdes. Répartis les bonnes réponses entre A, B, C et D.
- La question porte sur le document et ne se résout pas sans lui.
- Calibrage des niveaux :
  A1 : document très court de la vie quotidienne (panneau, message, annonce simple), information explicite. Écrit 30–60 mots, oral 15–35 mots.
  A2 : message, annonce, courriel, échange simple ; information concrète. Écrit 60–100 mots, oral 30–60 mots.
  B1 : dialogue ou texte informatif courant ; idée principale, détails, opinion simple. Écrit 100–160 mots, oral 60–110 mots.
  B2 : article, interview, reportage ; argumentation explicite, nuances, détails importants. Écrit 160–230 mots, oral 100–160 mots.
  C1 : texte ou discours long et structuré, registre soutenu ; implicite, intention de l'auteur, ton, opinion nuancée. Écrit 220–320 mots, oral 150–220 mots.
  C2 : texte abstrait, littéraire ou très argumenté ; ironie, sous-entendus, glissements de sens, vocabulaire rare ; les propositions ne se distinguent que par une nuance fine. Écrit 280–380 mots, oral 180–260 mots.
- Compréhension orale : écris le document comme il sera prononcé (langue orale naturelle : hésitations légères, reprises, registre adapté ; accents et réalités du Canada bienvenus). Chaque réplique indique un nom de locuteur et une voix f ou m ; alterne les voix dans les dialogues. Le document ne sera entendu qu'une fois : la question est lue avant l'écoute.
- L'explication, en français, cite l'indice du document et dit pourquoi chaque autre proposition est fausse.

Expression écrite (60 minutes en tout)
- Tâche 1 : message à une ou plusieurs personnes (60 à 120 mots) : décrire, raconter, expliquer, inviter…
- Tâche 2 : article, courrier ou blogue (120 à 150 mots) : compte rendu d'expérience ou d'événement avec commentaires.
- Tâche 3 : texte argumentatif (120 à 180 mots) comparant deux points de vue sur un sujet de société : fournis deux courts documents (80 à 120 mots chacun) aux positions opposées.
Expression orale (12 minutes)
- Tâche 1 : entretien dirigé sans préparation (2 min) : se présenter, parler de son parcours, de ses projets ; donne 5 à 6 relances d'examinateur.
- Tâche 2 : exercice en interaction avec préparation (2 min, puis 5 min 30) : le candidat obtient des informations dans une situation de la vie courante en posant des questions ; décris la situation et, dans « role », ce que sait l'examinateur ; 3 à 4 relances.
- Tâche 3 : expression d'un point de vue sans préparation (4 min 30) : une question de société à défendre ; 3 à 4 relances pour pousser l'argumentation.
- Rédige les consignes comme le jour de l'examen, au vouvoiement.`;

/** Message envoyé à Claude pour préparer un morceau du test. */
export function buildPartPrompt(o: {
  section: Section;
  part: { from: number; to: number };
  research: string;
  estimate?: number;
  avoid: string[];
  errors: ErrorEntry[];
  today: string;
  /** Leçons de l'aide-mémoire (titres) à remobiliser. */
  memos?: string[];
}): string {
  const { section, part } = o;
  const week = tcfWeek(o.today);
  const lines = [
    `Date : ${o.today}.`,
    `Épreuve : ${EPREUVE_LABEL[section.epreuve]}.`,
    `Objectif commun à toute la formation : ${TCF_GOAL.exam.label} le jour de l'examen (${TCF_GOAL.exam.comprehension}/699 en compréhension, ${TCF_GOAL.exam.expression}/20 en expression), ${TCF_GOAL.training.label} à l'entraînement.`,
  ];
  if (week)
    lines.push(
      `Cours de la semaine ${week.n} : thème « ${week.theme} », grammaire « ${week.grammar ?? "—"} », épreuve à renforcer : ${week.focus.map((f) => f.value).join(", ")}. Environ un tiers des documents porte sur le thème de la semaine ; ${section.epreuve === "co" || section.epreuve === "ce" ? "plusieurs questions testent la compréhension de la grammaire de la semaine en contexte" : "les consignes appellent naturellement la grammaire de la semaine"}.`,
    );
  if (o.estimate != null)
    lines.push(
      `Niveau actuel estimé du candidat dans cette épreuve : ${levelOf(section.epreuve, o.estimate)} (${o.estimate}${isComprehension(section.epreuve) ? "/699" : "/20"}). Objectif : C2.`,
    );
  if (section.levels) {
    const lv = section.levels.slice(part.from, part.to);
    lines.push(
      `Rédige ${lv.length} questions, dans cet ordre de niveaux : ${lv.join(", ")} (questions ${part.from + 1} à ${part.to} de l'épreuve).`,
    );
    lines.push(
      "Chaque question s'appuie sur un document différent ; varie les types de documents et les thèmes.",
    );
  } else {
    const tasks = (section.tasks ?? []).slice(part.from, part.to);
    lines.push(
      `Rédige les tâches suivantes : ${tasks.map((t) => `tâche ${t}`).join(", ")}.`,
    );
    lines.push(
      "Choisis des sujets d'actualité tirés des notes de recherche, exigeants pour un candidat qui vise C2.",
    );
  }
  if (o.memos?.length && section.epreuve !== "co")
    lines.push(`Leçons de l'aide-mémoire du candidat (à remobiliser quand c'est naturel) : ${o.memos.slice(0, 8).join(" ; ")}.`);
  if (o.avoid.length)
    lines.push(
      `Thèmes déjà utilisés récemment (à éviter) : ${o.avoid.slice(0, 40).join(" ; ")}.`,
    );
  const weak = o.errors
    .filter((e) => e.exam === "tcf" && !e.mastered)
    .slice(0, 12);
  if (weak.length && section.epreuve !== "co")
    lines.push(
      `Fautes récurrentes du candidat (tu peux en faire des pièges dans les distracteurs ou des points de grammaire à mobiliser) : ${weak.map((e) => `${e.correct || e.wrong}${e.rule ? ` (${e.rule})` : ""}`).join(" ; ")}.`,
    );
  lines.push(
    "",
    "## Notes de recherche (documents authentiques récents)",
    o.research.trim() ||
      "(recherche indisponible : appuie-toi sur des sujets d'actualité plausibles de 2026)",
  );
  return lines.join("\n");
}

export const EXPR_GRADE_SYSTEM = `Tu es correcteur certifié du TCF Canada. Tu évalues des productions selon la grille officielle (note sur 20 par tâche) :
réalisation de la tâche et adéquation à la consigne, cohérence et cohésion, étendue et maîtrise du lexique, morphosyntaxe et orthographe (à l'oral : grammaire et aisance d'après la transcription).
Barème indicatif : A1 1–3, A2 4–5, B1 6–9, B2 10–13, C1 14–15, C2 16–20. Sois exigeant et juste ; ne note pas au-dessus de ce que montre la production. Une tâche non traitée ou hors sujet vaut 0 à 2.
À l'oral, tu ne disposes que d'une transcription automatique : n'évalue pas la prononciation et ne pénalise pas la ponctuation ni les erreurs manifestes de transcription.
Pour chaque tâche : points forts, points à améliorer, une version corrigée et améliorée qui reste proche de la production (niveau C2), les erreurs relevées (forme fautive → forme correcte → règle courte), et ce qu'il faut faire pour atteindre le niveau suivant.
Note globale de l'épreuve : moyenne pondérée par l'exigence des tâches, arrondie à l'entier. Écris en français, au vouvoiement.`;

export const ExprGradeSchema = z.object({
  tasks: z.array(
    z.object({
      task: z.enum(["1", "2", "3"]),
      note: z.number().describe("Note entière de 0 à 20"),
      points_forts: z.string(),
      a_ameliorer: z.string(),
      version_corrigee: z.string(),
      erreurs: z.array(
        z.object({ wrong: z.string(), correct: z.string(), rule: z.string() }),
      ),
      niveau_suivant: z.string(),
    }),
  ),
  note_globale: z.number().describe("Note entière de 0 à 20"),
  bilan: z
    .string()
    .describe(
      "Deux à trois phrases : niveau atteint, priorité de travail pour progresser vers C2",
    ),
});
export type ExprGrade = z.infer<typeof ExprGradeSchema>;

export function buildExprGradePrompt(
  epreuve: "ee" | "eo",
  tasks: Array<EeTask | EoTask>,
  answers: Record<string, string>,
): string {
  return tasks
    .map((t) => {
      const ans = (answers[`t${t.task}`] ?? "").trim();
      const words = ans ? ans.split(/\s+/).length : 0;
      const docs =
        "documents" in t && t.documents.length
          ? `\nDocuments :\n${t.documents.map((d) => `« ${d.title} » : ${d.text}`).join("\n")}`
          : "";
      const range =
        epreuve === "ee"
          ? ` (attendu : ${EE_WORDS[Number(t.task)].join(" à ")} mots ; produit : ${words} mots)`
          : "";
      return `### ${EPREUVE_LABEL[epreuve]} — tâche ${t.task}${range}\nConsigne : ${t.consigne}${docs}\n${epreuve === "eo" ? "Transcription de la prise de parole" : "Production du candidat"} :\n${ans || "(rien)"}`;
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Tests côté interface

export interface QuestionResult {
  id: string;
  level: Level;
  chosen: string;
  correct: boolean;
}
export interface SectionResult {
  epreuve: Epreuve;
  /** Score /699 (compréhension) ou note /20 (expression). */
  value: number;
  level: Level;
  nclc: number;
  questions?: QuestionResult[];
  grade?: ExprGrade;
}
export interface SectionProgress {
  started_at?: string;
  submitted_at?: string;
  answers?: Record<string, string>;
  result?: SectionResult;
}
export interface TcfTest {
  id: string;
  day: string;
  kind: TestKind;
  title: string;
  plan: Plan;
  sources: Array<{ url: string; title: string }>;
  progress: Record<string, SectionProgress>;
  summary: { bilan: string; values: Estimates } | null;
  status: "pret" | "corrige";
  parts: Record<
    number,
    {
      status: "en_cours" | "pret" | "erreur";
      content: PartContent | null;
      error?: string | null;
    }
  >;
}

export interface TcfRow {
  id: string;
  day: string;
  kind: TestKind;
  title: string;
  plan: Plan;
  sources: Array<{ url: string; title: string }> | null;
  progress: Record<string, SectionProgress> | null;
  summary: TcfTest["summary"];
  status: "pret" | "corrige";
}
export interface TcfPartRow {
  test_id: string;
  idx: number;
  status: "en_cours" | "pret" | "erreur";
  content: PartContent | null;
  error: string | null;
}

/** Retire les réponses et explications des sections pas encore rendues. */
export function mapTcfRow(row: TcfRow, parts: TcfPartRow[]): TcfTest {
  const progress = row.progress ?? {};
  const out: TcfTest["parts"] = {};
  for (const p of parts.filter((x) => x.test_id === row.id)) {
    const spec = partSpec(row.plan, p.idx);
    const done = spec ? !!progress[String(spec.si)]?.submitted_at : false;
    let content = p.content;
    if (content && "items" in content && !done)
      content = {
        items: content.items.map((it) => ({
          ...it,
          answer: "A" as const,
          explanation: "",
        })),
      };
    out[p.idx] = { status: p.status, content, error: p.error };
  }
  return {
    id: row.id,
    day: row.day,
    kind: row.kind,
    title: row.title,
    plan: row.plan,
    sources: row.sources ?? [],
    progress,
    summary: row.summary,
    status: row.status,
    parts: out,
  };
}

/** Questions d'une section, dans l'ordre (une fois tous les morceaux prêts). */
export function sectionQuestions(
  test: Pick<TcfTest, "plan" | "parts">,
  si: number,
): Array<CoItem | CeItem> {
  return test.plan.sections[si].parts.flatMap((p) => {
    const c = test.parts[p.idx]?.content;
    return c && "items" in c ? c.items : [];
  });
}
export function sectionTasks(
  test: Pick<TcfTest, "plan" | "parts">,
  si: number,
): Array<EeTask | EoTask> {
  return test.plan.sections[si].parts.flatMap((p) => {
    const c = test.parts[p.idx]?.content;
    return c && "tasks" in c ? c.tasks : [];
  });
}
export function isReady(test: Pick<TcfTest, "plan" | "parts">): boolean {
  return test.plan.sections.every((s) =>
    s.parts.every((p) => test.parts[p.idx]?.status === "pret"),
  );
}

/** Corrige une section de compréhension. */
export function gradeComprehension(
  epreuve: Epreuve,
  items: Array<CoItem | CeItem>,
  answers: Record<string, string>,
  prior?: number,
): SectionResult {
  const questions = items.map((it) => ({
    id: it.id,
    level: it.level,
    chosen: answers[it.id] ?? "",
    correct: (answers[it.id] ?? "") === it.answer,
  }));
  const value = estimateScore(questions, prior ?? 350);
  return {
    epreuve,
    value,
    level: levelFromScore(value),
    nclc: nclcOf(epreuve, value),
    questions,
  };
}

/** Niveau actuel par épreuve : moyenne pondérée des trois derniers résultats (le plus récent compte le plus). */
export function currentEstimates(
  tests: Array<Pick<TcfTest, "day" | "progress" | "plan">>,
): Estimates {
  const hist = historyOf(tests);
  const out: Estimates = {};
  for (const e of EPREUVES) {
    const last = hist[e].slice(-3).reverse();
    if (!last.length) continue;
    const w = [0.5, 0.3, 0.2].slice(0, last.length);
    const sw = w.reduce((a, b) => a + b, 0);
    out[e] = Math.round(last.reduce((s, x, i) => s + x.value * w[i], 0) / sw);
  }
  return out;
}

/** Résultats successifs par épreuve, du plus ancien au plus récent. */
export function historyOf(
  tests: Array<Pick<TcfTest, "day" | "progress" | "plan">>,
): Record<Epreuve, Array<{ day: string; value: number }>> {
  const out: Record<Epreuve, Array<{ day: string; value: number }>> = {
    co: [],
    ce: [],
    ee: [],
    eo: [],
  };
  for (const t of [...tests].sort((a, b) => a.day.localeCompare(b.day))) {
    t.plan.sections.forEach((s, si) => {
      const r = t.progress[String(si)]?.result;
      if (r) out[s.epreuve].push({ day: t.day, value: r.value });
    });
  }
  return out;
}

export function recentThemes(
  tests: Array<Pick<TcfTest, "day" | "parts">>,
  today: string,
): string[] {
  const since = addDays(today, -21);
  const out: string[] = [];
  for (const t of tests.filter((x) => x.day >= since))
    for (const p of Object.values(t.parts)) {
      const c = p.content;
      if (!c) continue;
      if ("items" in c)
        for (const it of c.items)
          out.push("title" in it ? it.title : it.context);
      else for (const k of c.tasks) out.push(k.consigne.slice(0, 80));
    }
  return out;
}

/**
 * Résumé des derniers tests TCF Canada pour les autres outils de la formation (exercices du jour) :
 * niveau par épreuve face à l'objectif, compétences ratées en compréhension, conseils de la correction.
 */
export function tcfDigest(tests: TcfTest[]): string {
  const graded = tests.filter((t) => Object.values(t.progress).some((p) => p.result));
  if (!graded.length) return "";
  const est = currentEstimates(graded);
  const lines: string[] = [];
  for (const e of EPREUVES) {
    const v = est[e];
    if (v == null) continue;
    const unit = isComprehension(e) ? "/699" : "/20";
    lines.push(`- ${EPREUVE_LABEL[e]} : ${v}${unit} (${levelOf(e, v)}, NCLC ${nclcOf(e, v)}) ; objectif examen ${EXAM_TARGET[e]}${unit}, C2 à ${C2_TARGET[e]}${unit}.`);
  }
  const missed = new Map<string, number>();
  const advice: string[] = [];
  for (const t of [...graded].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6))
    t.plan.sections.forEach((s, si) => {
      const r = t.progress[String(si)]?.result;
      if (!r) return;
      if (r.questions) {
        const items = new Map(sectionQuestions(t, si).map((q) => [q.id, q]));
        for (const q of r.questions)
          if (!q.correct) {
            const it = items.get(q.id);
            const key = `${EPREUVE_SHORT[s.epreuve]} ${q.level} · ${it?.focus || "compréhension"}`;
            missed.set(key, (missed.get(key) ?? 0) + 1);
          }
      }
      for (const task of r.grade?.tasks ?? []) if (task.niveau_suivant) advice.push(`- ${EPREUVE_SHORT[s.epreuve]} tâche ${task.task} (${task.note}/20) : ${task.niveau_suivant}`);
    });
  const top = [...missed].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return [
    "Niveau actuel :",
    ...lines,
    top.length ? "Questions de compréhension ratées récemment (épreuve, niveau, compétence) :" : "",
    ...top.map(([k, n]) => `- ${k} (${n} fois)`),
    advice.length ? "Pour passer au niveau suivant, d'après les dernières corrections :" : "",
    ...advice.slice(0, 6),
  ]
    .filter(Boolean)
    .join("\n");
}
