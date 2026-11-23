/**
 * Deux programmes à la suite :
 *  - TCF Canada du 16 novembre 2026 au 15 février 2027 (examen le 15/02) ;
 *  - IELTS General Training du 16 février au 27 mars 2027 (examen le 27/03).
 * Données des programmes et calcul du plan de chaque journée. Aucune entrée/sortie : tout est testable.
 */

export type Lang = "tcf" | "ielts";

/** Événement navigateur : nombre d'actions du jour restant à cocher (pastille de la barre latérale). */
export const FORMATION_TODAY_EVENT = "formation:today";

export const PROGRAM_START = "2026-11-16";
export const PROGRAM_END = "2027-03-27";
export const TCF_DATE = "2027-02-15";
export const IELTS_DATE = "2027-03-27";
/** Dernier jour où l'on apprend du nouveau avant le TCF Canada (ensuite : repos actif). */
export const TCF_LAST_NEW = "2027-02-12";

/**
 * Objectif unique de toute la préparation TCF Canada : cours, exercices du jour, tests, carnet et aide-mémoire
 * visent la même cible. NCLC 10 donne le maximum de points de langue à Entrée express ; l'entraînement vise C2
 * pour garder une marge le jour de l'examen.
 */
export const TCF_GOAL = {
  exam: { label: "NCLC 10", comprehension: 549, expression: 16 },
  training: { label: "C2", comprehension: 600, expression: 16 },
} as const;

export type TcfEpreuve = "co" | "ce" | "ee" | "eo";
/** Épreuves du test TCF Canada de chaque jour, du lundi (1) au dimanche (7). Samedi et dimanche dépendent du programme. */
export const TCF_ROTATION: Record<number, TcfEpreuve[]> = { 1: ["co"], 2: ["ce"], 3: ["ee"], 4: ["eo", "co"], 5: ["ce", "co", "ee"], 6: [], 7: [] };
/** Créneau du jour où se fait chaque épreuve du test. */
const TEST_SLOT: Record<TcfEpreuve, string> = { co: "t1", ce: "midi", ee: "am", eo: "pm" };

export interface Phase {
  prog: Lang;
  n: number;
  name: string;
  from: string;
  to: string;
  goal: string;
  change?: string;
}

export interface Send {
  label: string;
  subject?: string;
}

export interface Week {
  prog: Lang;
  n: number;
  from: string;
  to: string;
  theme: string;
  /** TCF : grammaire de la semaine. */
  grammar?: string;
  /** Épreuve à renforcer (TCF) ou détail par épreuve (IELTS). */
  focus: Array<{ label: string; value: string }>;
  goal: string;
  sends: Send[];
  /** Samedi : examen blanc complet ou entraînement. */
  saturday: { label: string; mock: boolean } | null;
  note?: string;
}

export interface Program {
  id: Lang;
  name: string;
  from: string;
  to: string;
  exam: string;
  target: string;
  phases: Phase[];
  weeks: Week[];
}

const PACK = "Sujets du pack";
const IELTS_SAT_TRAINING = "Un Listening et un Reading complets";

const tcfWeek = (n: number, from: string, to: string, theme: string, grammar: string, focus: string, goal: string, sends: Send[], saturday: Week["saturday"], note?: string): Week => ({
  prog: "tcf", n, from, to, theme, grammar, focus: [{ label: "Épreuve à renforcer", value: focus }], goal, sends, saturday, note,
});

export const TCF: Program = {
  id: "tcf",
  name: "TCF Canada",
  from: "2026-11-16",
  to: TCF_DATE,
  exam: TCF_DATE,
  target: "NCLC 10 : 549 en compréhension, 16/20 en expression (entraînement : 600 et 18/20)",
  phases: [
    { prog: "tcf", n: 1, name: "Fondations", from: "2026-11-16", to: "2026-12-13", goal: "Diagnostic, structure des tâches, premières banques de phrases", change: "Ressources gratuites uniquement ; une copie corrigée chaque jour de semaine ; un examen blanc chaque samedi dès le 28/11" },
    { prog: "tcf", n: 2, name: "Intensif", from: "2026-12-14", to: "2027-01-24", goal: "16/20 en expression, 549 en compréhension", change: "Achat du pack Gold ; un examen blanc chaque samedi" },
    { prog: "tcf", n: 3, name: "Simulation", from: "2027-01-25", to: "2027-02-15", goal: "18/20 en expression, 600 en compréhension", change: "Un examen blanc chaque samedi ; rien de nouveau après le 12/02" },
  ],
  weeks: [
    tcfWeek(1, "2026-11-16", "2026-11-22", "Travail et emploi", "Subjonctif après la volonté et le sentiment", "Diagnostic des quatre épreuves", "Diagnostic écrit et oral",
      [{ label: "EE tâche 3", subject: "Télétravail" }, { label: "EO tâche 1", subject: "Votre présentation (parcours, métier, projets)" }, { label: "Scores du diagnostic", subject: "Exemples officiels" }],
      { label: "Diagnostic des 4 épreuves (exemples officiels)", mock: true }),
    tcfWeek(2, "2026-11-23", "2026-11-29", "Technologie et numérique", "Subjonctif après « bien que », « pour que », « à moins que »", "EE tâche 3 : structure", "Identifier la compétence la plus faible",
      [{ label: "EE tâche 1", subject: "Inviter un ami" }, { label: "EE tâche 2", subject: "Une expérience marquante" }, { label: "EE tâche 3", subject: "Semaine de 4 jours" }, { label: "EO tâche 3", subject: "« Les réseaux sociaux rendent-ils les jeunes plus isolés ? »" }],
      { label: "Examen blanc n° 1 complet", mock: true }),
    tcfWeek(3, "2026-11-30", "2026-12-06", "Environnement et climat", "Connecteurs d'opposition et de concession", "EO tâche 3 : structure", "Maîtriser la structure de la tâche 3",
      [{ label: "EE tâche 3 (1/2)", subject: "Faut-il taxer davantage les produits sucrés ?" }, { label: "EE tâche 3 (2/2)", subject: "Sujet au choix" }, { label: "EO tâche 2", subject: "10 questions pour se renseigner sur un appartement" }, { label: "EO tâche 3", subject: "« Le diplôme est-il encore la clé de l'emploi ? »" }, { label: "Scores CO et CE" }],
      { label: "Examen blanc n° 2 complet", mock: true }),
    tcfWeek(4, "2026-12-07", "2026-12-13", "Santé et alimentation", "Pronoms relatifs composés (dont, lequel, auquel)", "EE tâches 1 et 2 : registres", "Registres et temps du passé sans faute",
      [{ label: "EE tâche 1", subject: "Réclamation à un service client" }, { label: "EE tâche 2", subject: "Récit d'un voyage" }, { label: "EO tâche 3", subject: "« L'IA va-t-elle remplacer les recruteurs ? »" }],
      { label: "Examen blanc n° 3 complet", mock: true }),
    tcfWeek(5, "2026-12-14", "2026-12-20", "Éducation et formation", "Hypothèse : si + imparfait ou plus-que-parfait, conditionnel passé", "Examen blanc n° 4", "Score de référence en conditions réelles",
      [{ label: "Achat du pack Gold (49,99 $ US)", subject: "formation-tcfcanada.com" }, { label: "Examen blanc n° 4 : scores et copies", subject: PACK }],
      { label: "Examen blanc n° 4 complet", mock: true }),
    tcfWeek(6, "2026-12-21", "2026-12-27", "Famille et société", "Accords du participe passé", "Semaine allégée (cérémonie et fêtes)", "Garder le rythme",
      [{ label: "Une EE tâche 3", subject: "Gratuité des transports publics" }],
      { label: "Examen blanc n° 5 complet", mock: true }, "Semaine allégée : cérémonie et fêtes."),
    tcfWeek(7, "2026-12-28", "2027-01-03", "Ville, transports, logement", "Nominalisation et voix passive", "Examen blanc n° 6", "Vocabulaire de la nuance et connecteurs",
      [{ label: "Examen blanc n° 6 : scores et copies", subject: PACK }, { label: "EO tâche 3", subject: "« Faut-il interdire la voiture en centre-ville ? »" }],
      { label: "Examen blanc n° 6 complet", mock: true }),
    tcfWeek(8, "2027-01-04", "2027-01-10", "Consommation et économie", "Gérondif et participe présent", "EO tâche 2 : questions variées", "16/20 en EE",
      [{ label: "Inscription au TCF Canada (le 05/01)", subject: "Examen du 15/02/2027" }, { label: "EE tâche 1", subject: PACK }, { label: "EE tâche 3", subject: PACK }, { label: "EO tâche 2", subject: PACK }],
      { label: "Examen blanc n° 7 complet", mock: true }),
    tcfWeek(9, "2027-01-11", "2027-01-17", "Immigration et diversité", "Discours rapporté et concordance des temps", "Examen blanc n° 8", "16/20 en EO",
      [{ label: "Examen blanc n° 8 : scores et copies", subject: PACK }, { label: "EO : les 3 tâches en conditions réelles", subject: "Immigration et pénurie de main-d'œuvre" }],
      { label: "Examen blanc n° 8 complet", mock: true }),
    tcfWeek(10, "2027-01-18", "2027-01-24", "Médias et information", "Mise en relief, négations complexes", "Compréhension : dernières questions (C1-C2)", "549 ou plus en CO et CE",
      [{ label: "EE tâche 3 (1/2)", subject: PACK }, { label: "EE tâche 3 (2/2)", subject: PACK }, { label: "Scores CO et CE des séries difficiles" }],
      { label: "Examen blanc n° 9 complet", mock: true }),
    tcfWeek(11, "2027-01-25", "2027-01-31", "Culture, loisirs, tourisme", "Révision des registres (formel, courant, familier)", "Examen blanc n° 10", "17/20 en expression",
      [{ label: "Examen blanc n° 10 : scores et copies", subject: PACK }, { label: "EO tâche 3", subject: PACK }, { label: "Réserver l'IELTS du 27/03", subject: "British Council ou IDP ; sinon la date la plus proche entre le 20/03 et le 10/04" }],
      { label: "Examen blanc n° 10 complet", mock: true }),
    tcfWeek(12, "2027-02-01", "2027-02-07", "Sport et bien-être", "Révision générale et erreurs fréquentes", "Examen blanc n° 11, idéalement à l'Institut français", "Simulation finale à 18/20 et 600",
      [{ label: "Examen blanc n° 11 complet", subject: "Idéalement à l'Institut français" }],
      { label: "Examen blanc n° 11 complet (idéalement à l'Institut français)", mock: true }),
    tcfWeek(13, "2027-02-08", "2027-02-14", "Révision de tous les thèmes", "Carnet d'erreurs uniquement", "Repos actif, rien de nouveau après le 12/02", "Arriver reposé le 15/02",
      [{ label: "Une EE tâche 3 le mardi", subject: PACK }, { label: "Relecture du carnet d'erreurs" }],
      null, "Rien de nouveau après le 12/02 ; le week-end des 13 et 14/02 est un repos."),
  ],
};

const ieltsWeek = (n: number, from: string, to: string, theme: string, writing: string, rl: string, speaking: string, goal: string, sends: Send[], saturday: Week["saturday"], note?: string): Week => ({
  prog: "ielts", n, from, to, theme,
  focus: [{ label: "Writing", value: writing }, { label: "Reading et Listening", value: rl }, { label: "Speaking", value: speaking }],
  goal, sends, saturday, note,
});

export const IELTS: Program = {
  id: "ielts",
  name: "IELTS General Training",
  from: "2027-02-16",
  to: IELTS_DATE,
  exam: IELTS_DATE,
  target: "CLB 9 : Listening 8,0 ; Reading 7,0 ; Writing 7,0 ; Speaking 7,0",
  phases: [
    { prog: "ielts", n: 1, name: "Diagnostic et méthode", from: "2027-02-16", to: "2027-02-28", goal: "Connaître le format, mesurer le niveau de départ, maîtriser les lettres de la Task 1" },
    { prog: "ielts", n: 2, name: "Intensif", from: "2027-03-01", to: "2027-03-21", goal: "Task 2 à 7,0, Reading à 7,0 ; deux examens blancs complets" },
    { prog: "ielts", n: 3, name: "Finition", from: "2027-03-22", to: IELTS_DATE, goal: "Révision légère, gestion du stress ; rien de nouveau après le 25/03" },
  ],
  weeks: [
    ieltsWeek(1, "2027-02-16", "2027-02-21", "Travail et carrière", "Diagnostic ; les 3 types de lettres", "Diagnostic complet ; Listening parts 1 et 2", "Diagnostic ; Part 1", "Niveau de départ",
      [{ label: "Lettre de la Task 1", subject: "Lettre à M. Kouassi" }, { label: "Task 2 de diagnostic", subject: "« Some people think remote work will replace offices. Do you agree? »" }, { label: "Transcription d'une Part 2", subject: "« Describe a skill you learned recently »" }, { label: "Scores du diagnostic" }],
      { label: "Diagnostic : Listening et Reading complets", mock: false }),
    ieltsWeek(2, "2027-02-22", "2027-02-28", "Technologie et médias", "Task 1 : lettres formelle, semi-formelle et amicale", "Reading sections 1 et 2", "Part 2 : méthode des 2 minutes", "7,0 en Task 1",
      [{ label: "Lettre formelle (Task 1)", subject: "Une plainte à un hôtel" }, { label: "Lettre semi-formelle (Task 1)", subject: "Une demande à un collègue" }, { label: "Lettre amicale (Task 1)", subject: "Une invitation à un ami" }, { label: "Une Part 2", subject: "« Describe a person who helped you »" }],
      { label: IELTS_SAT_TRAINING, mock: false }),
    ieltsWeek(3, "2027-03-01", "2027-03-07", "Environnement", "Task 2 : essai d'opinion", "Listening parts 3 et 4 ; examen blanc n° 1 le 6/03", "Part 2 et Part 3", "6,5 à 7,0 en Task 2",
      [{ label: "Task 2 (1/2)", subject: "« Should governments tax plastic packaging? »" }, { label: "Task 2 (2/2)", subject: "Sujet au choix" }, { label: "Examen blanc n° 1 : scores", subject: "Sujets de l'examen blanc" }],
      { label: "Examen blanc n° 1 complet", mock: true }),
    ieltsWeek(4, "2027-03-08", "2027-03-14", "Santé et éducation", "Task 2 : essais discussion, problème-solution et à double question", "Reading section 3 ; True / False / Not Given", "Part 3 : développer et justifier", "7,0 en Task 2",
      [{ label: "Task 2 (1/2)", subject: "« Why do young people leave rural areas, and how can it be stopped? »" }, { label: "Task 2 (2/2)", subject: "« Discuss both views: university or vocational training? »" }, { label: "Une Part 3" }],
      { label: IELTS_SAT_TRAINING, mock: false }),
    ieltsWeek(5, "2027-03-15", "2027-03-21", "Villes, transports, société", "Tasks 1 et 2 en 60 min d'affilée", "Examen blanc n° 2 le 20/03", "Les 3 parts en conditions réelles", "CLB 9 atteint en simulation",
      [{ label: "Examen blanc n° 2 complet : scores", subject: "Sujets de l'examen blanc" }, { label: "Speaking : les 3 parts", subject: "Sujets de l'examen blanc" }],
      { label: "Examen blanc n° 2 complet", mock: true }),
    ieltsWeek(6, "2027-03-22", IELTS_DATE, "Révision de tous les thèmes", "Une Task 2 le mardi, puis relecture", "Un Listening léger le mercredi", "Une simulation complète le mardi", "Arriver reposé le 27/03",
      [{ label: "Une Task 2 le mardi", subject: "Sujet au choix" }],
      null, "Rien de nouveau après le 25/03. Examen le samedi 27/03."),
  ],
};

export const PROGRAMS: Program[] = [TCF, IELTS];
export const ALL_WEEKS: Week[] = [...TCF.weeks, ...IELTS.weeks];
export const ALL_PHASES: Phase[] = [...TCF.phases, ...IELTS.phases];

/** Clé d'un envoi : « t5:e0 » (TCF, semaine 5, 1er envoi), « i3:e1 » (IELTS). */
export const sendKey = (w: Pick<Week, "prog" | "n">, i: number) => `${w.prog === "tcf" ? "t" : "i"}${w.n}:e${i}`;

/** Envois rattachés à un jour précis : cocher dans la journée ou dans la semaine revient au même. */
const DATED_SENDS: Record<string, string> = {
  "2026-12-14": "t5:e0", // achat du pack Gold
  "2027-01-05": "t8:e0", // inscription au TCF
  "2027-01-25": "t11:e2", // réservation de l'IELTS
  "2027-02-09": "t13:e0", // EE tâche 3 le mardi
  "2027-03-23": "i6:e0", // Task 2 le mardi
};
/** Envois placés un jour précis (les autres valent pour toute la semaine). */
export const DATED_SEND_KEYS: ReadonlySet<string> = new Set(Object.values(DATED_SENDS));

// ---------------------------------------------------------------- dates

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = lundi … 7 = dimanche. */
export function weekday(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export const inProgram = (iso: string) => iso >= PROGRAM_START && iso <= PROGRAM_END;
export const clampToProgram = (iso: string) => (iso < PROGRAM_START ? PROGRAM_START : iso > PROGRAM_END ? PROGRAM_END : iso);

export function programOf(iso: string): Program | null {
  return PROGRAMS.find((p) => iso >= p.from && iso <= p.to) ?? null;
}

export function weekOf(iso: string): Week | null {
  return ALL_WEEKS.find((w) => iso >= w.from && iso <= w.to) ?? null;
}

export function phaseOf(iso: string): Phase | null {
  return ALL_PHASES.find((p) => iso >= p.from && iso <= p.to) ?? null;
}

export function programDays(): string[] {
  const out: string[] = [];
  for (let d = PROGRAM_START; d <= PROGRAM_END; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------- plan du jour

export type SlotGroup = "matin" | "trajet" | "midi" | "soir" | "weekend" | "jalon" | "examen";

export interface DayItem {
  key: string;
  time: string;
  minutes: number | null;
  label: string;
  detail?: string;
  lang: Lang | null;
  group: SlotGroup;
  /** Sujet du guide affiché dans le tiroir de la tâche (méthode, ressources). */
  topic: string;
  /** Outil de l'application qui sert à faire cette tâche (bouton dans le plan du jour). */
  tool?: "tcf" | "exercices";
  /** Épreuve du test TCF Canada faite dans ce créneau. */
  epreuve?: TcfEpreuve;
}

export interface DayPlan {
  date: string;
  program: Program;
  week: Week | null;
  phase: Phase | null;
  kind: "semaine" | "samedi" | "dimanche" | "examen" | "repos";
  title: string;
  items: DayItem[];
  tip?: string;
}

const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const dayName = (iso: string) => DAY_NAMES[weekday(iso)];

type Slot = Omit<DayItem, "key"> & { id: string };

function tcfWeekday(iso: string, w: Week): Slot[] {
  const slots = tcfWeekdayBase(iso, w);
  if (iso > TCF_LAST_NEW) return slots;
  const d = weekday(iso);
  for (const e of TCF_ROTATION[d] ?? []) {
    const slot = slots.find((x) => x.id === TEST_SLOT[e]);
    if (slot) Object.assign(slot, { tool: "tcf", epreuve: e, detail: `Test TCF Canada du jour, en conditions réelles (onglet TCF Canada)${slot.detail ? ` · ${slot.detail}` : ""}` });
  }
  const fin = slots.find((x) => x.id === "fin");
  if (fin) Object.assign(fin, { minutes: 20, tool: "exercices", label: "Exercices du jour, puis carnet d'erreurs", detail: "10 exercices préparés par Claude à partir du carnet, de l'aide-mémoire, du cours et des tests" });
  return slots;
}

function tcfWeekdayBase(iso: string, w: Week): Slot[] {
  const d = weekday(iso);
  const writing = d === 2 ? "tâches 1 et 2" : d === 4 ? "exercices de grammaire de la semaine et réécriture d'une copie corrigée" : "tâche 3";
  const oral = d === 2 ? "tâche 2" : d === 4 ? "tâche 1" : "tâche 3";
  return [
    { id: "am", time: "05:15", minutes: 45, group: "matin", lang: "tcf", topic: d === 4 ? "tcf-grammaire" : d === 2 ? "tcf-ee12" : "tcf-ee3", label: d === 4 ? "Grammaire et réécriture d'une copie corrigée" : `Expression écrite chronométrée : ${writing}`, detail: d === 4 ? w.grammar : undefined },
    { id: "t1", time: "Trajet aller", minutes: 30, group: "trajet", lang: "tcf", topic: "tcf-co", label: "Compréhension orale", detail: iso >= "2026-12-14" ? "Séries du pack Gold" : "Exercices TCF sur téléphone (RFI, TV5Monde)" },
    { id: "t2", time: "Trajet aller", minutes: 60, group: "trajet", lang: "tcf", topic: "fr-podcast", label: "Podcast français de niveau C1-C2" },
    { id: "t3", time: "Trajet aller", minutes: 20, group: "trajet", lang: "tcf", topic: "anki", label: `Anki : 20 mots du thème « ${w.theme} »` },
    { id: "midi", time: "Pause déjeuner", minutes: 20, group: "midi", lang: "tcf", topic: "tcf-ce", label: "Compréhension écrite : un texte et ses questions, chronométré" },
    { id: "t4", time: "Trajet retour", minutes: 75, group: "trajet", lang: "tcf", topic: "fr-podcast", label: "Podcast français et relecture mentale du carnet d'erreurs" },
    { id: "en", time: "Trajet retour", minutes: 15, group: "trajet", lang: "ielts", topic: "en-maintien", label: "Maintien de l'anglais", detail: "BBC 6 Minute English ou BBC Global News Podcast" },
    { id: "pm", time: "20:30", minutes: 45, group: "soir", lang: "tcf", topic: d === 2 ? "tcf-eo2" : d === 4 ? "tcf-eo1" : "tcf-eo3", label: `Expression orale : ${oral}`, detail: "S'enregistrer, transcrire, corriger" },
    { id: "fin", time: "21:15", minutes: 15, group: "soir", lang: "tcf", topic: "carnet", label: "Carnet d'erreurs, puis lecture du sujet du lendemain" },
  ];
}

function ieltsWeekday(iso: string, w: Week): Slot[] {
  const d = weekday(iso);
  const writing = d === 2 || d === 4 ? "Writing Task 1 (20 min) et réécriture d'une copie corrigée" : "Writing Task 2 chronométrée (40 min)";
  const speaking = d === 1 || d === 3 ? "Speaking Part 2 (2 min) et Part 3" : d === 5 ? "Speaking : les 3 parts d'affilée" : "Speaking Part 1";
  return [
    { id: "am", time: "05:15", minutes: 45, group: "matin", lang: "ielts", topic: d === 2 || d === 4 ? "ielts-task1" : "ielts-task2", label: writing },
    { id: "t1", time: "Trajet aller", minutes: 30, group: "trajet", lang: "ielts", topic: "ielts-listening", label: "Listening : une section d'un test officiel" },
    { id: "t2", time: "Trajet aller", minutes: 60, group: "trajet", lang: "ielts", topic: "en-podcast", label: "Podcast anglais" },
    { id: "t3", time: "Trajet aller", minutes: 20, group: "trajet", lang: "ielts", topic: "anki", label: `Anki : 20 collocations du thème « ${w.theme} »` },
    { id: "midi", time: "Pause déjeuner", minutes: 20, group: "midi", lang: "ielts", topic: "ielts-reading", label: "Reading : un passage et ses questions, chronométré" },
    { id: "t4", time: "Trajet retour", minutes: 90, group: "trajet", lang: "ielts", topic: "en-podcast", label: "Podcast anglais, idées notées pour la Task 2" },
    { id: "pm", time: "20:30", minutes: 45, group: "soir", lang: "ielts", topic: "ielts-speaking", label: speaking, detail: "S'enregistrer, transcrire, corriger" },
    { id: "fin", time: "21:15", minutes: 15, group: "soir", lang: "ielts", topic: "carnet", label: "Carnet d'erreurs, puis lecture du sujet du lendemain" },
  ];
}

/** Semaine de finition IELTS (22 au 26/03) : programme allégé jour par jour. */
const IELTS_FINISH: Record<string, Slot[]> = {
  "2027-03-22": [
    { id: "t2", time: "Trajets", minutes: 60, group: "trajet", topic: "en-podcast", lang: "ielts", label: "Podcast anglais" },
    { id: "t3", time: "Trajet aller", minutes: 20, group: "trajet", topic: "anki", lang: "ielts", label: "Anki : révision des collocations" },
    { id: "fin", time: "21:00", minutes: 30, group: "soir", topic: "carnet", lang: "ielts", label: "Relecture du carnet d'erreurs" },
  ],
  "2027-03-23": [
    { id: "pm", time: "20:30", minutes: 15, group: "soir", topic: "ielts-speaking", lang: "ielts", label: "Simulation complète du Speaking (3 parts)" },
    { id: "t2", time: "Trajets", minutes: 60, group: "trajet", topic: "en-podcast", lang: "ielts", label: "Podcast anglais" },
  ],
  "2027-03-24": [
    { id: "t1", time: "Trajet aller", minutes: 30, group: "trajet", topic: "ielts-listening", lang: "ielts", label: "Listening léger : une section" },
    { id: "fin", time: "21:00", minutes: 30, group: "soir", topic: "carnet", lang: "ielts", label: "Relecture du carnet d'erreurs" },
  ],
  "2027-03-25": [
    { id: "rev", time: "Soir", minutes: 30, group: "soir", topic: "ielts-revision", lang: "ielts", label: "Révision légère : phrases clés et registres des lettres", detail: "Dernier jour de révision : rien de nouveau ensuite" },
  ],
  "2027-03-26": [
    { id: "prep", time: "Soir", minutes: null, group: "soir", topic: "veille-examen", lang: null, label: "Préparer la convocation, la pièce d'identité et le trajet ; se coucher tôt" },
  ],
};

export function dayPlan(iso: string): DayPlan | null {
  const program = programOf(iso);
  if (!program) return null;
  const week = weekOf(iso);
  const phase = phaseOf(iso);
  const d = weekday(iso);
  const k = (id: string) => `${iso}:${id}`;
  const base = { date: iso, program, week, phase };

  if (iso === TCF_DATE) {
    return {
      ...base, kind: "examen", title: "Jour du TCF Canada",
      items: [{ key: k("examen"), time: "Journée", minutes: null, label: "Passer le TCF Canada", detail: "Objectif NCLC 10 : 549 en compréhension, 16/20 en expression", lang: "tcf", group: "examen", topic: "examen-tcf" }],
      tip: "Lisez les réponses proposées avant d'écouter ou de lire le document.",
    };
  }
  if (iso === IELTS_DATE) {
    return {
      ...base, kind: "examen", title: "Jour de l'IELTS General Training",
      items: [{ key: k("examen"), time: "Journée", minutes: null, label: "Passer l'IELTS General Training", detail: "Objectif CLB 9 : Listening 8,0 ; Reading 7,0 ; Writing 7,0 ; Speaking 7,0", lang: "ielts", group: "examen", topic: "examen-ielts" }],
      tip: "Writing : commencez par la Task 2, qui compte double.",
    };
  }
  if (!week) return null;

  const dated: DayItem[] = [];
  const ref = DATED_SENDS[iso];
  if (ref) {
    const s = week.sends[Number(ref.split(":e")[1])];
    if (s) dated.push({ key: ref, time: "À faire", minutes: null, label: s.label, detail: s.subject, lang: program.id, group: "jalon", topic: "jalon:" + ref });
  }
  const withKeys = (slots: Slot[]): DayItem[] => slots.map(({ id, ...s }) => ({ ...s, key: k(id) }));

  // Fin de programme allégée.
  if (IELTS_FINISH[iso]) {
    return { ...base, kind: "repos", title: `${DAY_NAMES[d]} · finition`, items: [...dated, ...withKeys(IELTS_FINISH[iso])], tip: "Révision légère et gestion du stress : rien de nouveau après le 25/03." };
  }
  if (program.id === "tcf" && iso >= "2027-02-13") {
    return {
      ...base, kind: "repos", title: `${DAY_NAMES[d]} · repos avant le TCF`,
      items: [{ key: k("repos"), time: "Journée", minutes: null, label: "Repos : relecture légère du carnet d'erreurs", lang: "tcf", group: "weekend", topic: "veille-examen" }],
      tip: "Arrivez reposé le 15/02 : rien de nouveau.",
    };
  }

  if (d === 6) {
    const items: DayItem[] = [...dated];
    if (week.saturday) {
      const app = program.id === "tcf" && iso <= TCF_LAST_NEW;
      items.push({
        key: k("matin"), time: "08:00", minutes: 180, label: week.saturday.label,
        detail: app
          ? week.saturday.mock ? "Dans l'onglet TCF Canada : examen blanc complet, résultats enregistrés dans Scores" : "Dans l'onglet TCF Canada : compréhension la plus faible (39 questions) et EE tâche 3"
          : week.saturday.mock ? "En conditions réelles, chronomètre lancé" : "Chronométré",
        lang: program.id, group: "weekend", topic: program.id + (week.saturday.mock ? "-blanc" : "-samedi"), ...(app ? { tool: "tcf" as const } : {}),
      });
      items.push({ key: k("correction"), time: "15:00", minutes: 60, label: "Correction et carnet d'erreurs", lang: program.id, group: "weekend", topic: "correction" });
    }
    return { ...base, kind: "samedi", title: `Samedi · ${week.saturday?.mock ? "examen blanc" : "entraînement"}`, items };
  }

  if (d === 7) {
    const study: DayItem[] =
      program.id === "tcf"
        ? [
            { key: k("grammaire"), time: "15:00", minutes: 60, label: `Grammaire de la semaine : ${week.grammar}`, lang: "tcf", group: "weekend", topic: "tcf-grammaire" },
            { key: k("shadowing"), time: "16:00", minutes: 30, label: "Shadowing en français : répéter à voix haute un extrait audio", lang: "tcf", group: "weekend", topic: "shadowing" },
          ]
        : [{ key: k("shadowing"), time: "15:00", minutes: 60, label: "30 min de shadowing et révision du vocabulaire", lang: "ielts", group: "weekend", topic: "shadowing" }];
    return {
      ...base, kind: "dimanche", title: "Dimanche · révision et bilan",
      items: [
        ...dated,
        ...study,
        ...(program.id === "tcf" && iso <= TCF_LAST_NEW
          ? [{ key: k("test"), time: "11:00", minutes: 30, label: "Test TCF Canada : votre point faible", detail: "L'épreuve de compréhension la plus éloignée de l'objectif (onglet TCF Canada)", lang: "tcf" as const, group: "weekend" as const, topic: "tcf-test", tool: "tcf" as const }]
          : []),
        { key: k("carnet"), time: "Après-midi", minutes: 15, label: "Relire le carnet d'erreurs", detail: "Une erreur revenue 3 fois devient un exercice ciblé la semaine suivante", lang: program.id, group: "weekend", topic: "carnet" },
        { key: k("bilan"), time: "20:00", minutes: null, label: "Envoyer le bilan de la semaine à Claude (scores et copies)", lang: null, group: "weekend", topic: "bilan" },
      ],
    };
  }

  const slots = program.id === "tcf" ? tcfWeekday(iso, week) : ieltsWeekday(iso, week);
  return {
    ...base, kind: "semaine", title: `${DAY_NAMES[d]} · ${program.id === "tcf" ? "TCF" : "IELTS"}`,
    items: [...dated, ...withKeys(slots)],
    tip: program.id === "tcf" && iso > "2027-02-12" ? "Rien de nouveau : relisez le carnet d'erreurs." : "Si vous partez avant 6 h, faites l'écriture du matin à 20:30 et l'oral en 15 minutes juste après.",
  };
}

/** Clés de toutes les tâches d'une semaine : créneaux des jours + envois. */
export function weekKeys(w: Week): string[] {
  const keys = new Set<string>();
  for (let d = w.from; d <= w.to; d = addDays(d, 1)) dayPlan(d)?.items.forEach((i) => keys.add(i.key));
  w.sends.forEach((_, i) => keys.add(sendKey(w, i)));
  return [...keys];
}

export function programKeys(p: Program): string[] {
  const keys = new Set<string>();
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) dayPlan(d)?.items.forEach((i) => keys.add(i.key));
  p.weeks.forEach((w) => w.sends.forEach((_, i) => keys.add(sendKey(w, i))));
  return [...keys];
}

export function allKeys(): string[] {
  return [...new Set([...programKeys(TCF), ...programKeys(IELTS)])];
}

/** Clés des tâches datées jusqu'au jour donné inclus (pour mesurer le retard). */
export function keysUntil(iso: string): string[] {
  const keys = new Set<string>();
  for (const d of programDays()) {
    if (d > iso) break;
    dayPlan(d)?.items.forEach((i) => keys.add(i.key));
  }
  return [...keys];
}

/** Jours consécutifs entièrement faits, en remontant depuis aujourd'hui (ou hier si aujourd'hui n'est pas fini). */
export function streak(today: string, done: Set<string>): number {
  const full = (iso: string) => {
    const p = dayPlan(iso);
    return !!p && p.items.length > 0 && p.items.every((i) => done.has(i.key));
  };
  let d = clampToProgram(today);
  if (!full(d)) d = addDays(d, -1);
  let n = 0;
  while (d >= PROGRAM_START && full(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ---------------------------------------------------------------- niveaux NCLC / CLB

type Scale = Array<[number, number]>; // [seuil minimal, niveau], du plus haut au plus bas

const TCF_SCALE: Scale[] = [
  [[549, 10], [523, 9], [503, 8], [458, 7], [398, 6], [369, 5], [331, 4]], // CO
  [[549, 10], [524, 9], [499, 8], [453, 7], [406, 6], [375, 5], [342, 4]], // CE
  [[16, 10], [14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]], // EE
  [[16, 10], [14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]], // EO
];

const IELTS_SCALE: Scale[] = [
  [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]], // Listening
  [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]], // Reading
  [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]], // Writing
  [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]], // Speaking
];

function level(scale: Scale, v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  for (const [min, lvl] of scale) if (v >= min) return lvl;
  return 0;
}

export const SKILLS = {
  tcf: [
    { id: "co", label: "CO", name: "Compréhension orale", max: 699 },
    { id: "ce", label: "CE", name: "Compréhension écrite", max: 699 },
    { id: "ee", label: "EE", name: "Expression écrite", max: 20 },
    { id: "eo", label: "EO", name: "Expression orale", max: 20 },
  ],
  ielts: [
    { id: "l", label: "Listening", name: "Listening", max: 9 },
    { id: "r", label: "Reading", name: "Reading", max: 9 },
    { id: "w", label: "Writing", name: "Writing", max: 9 },
    { id: "s", label: "Speaking", name: "Speaking", max: 9 },
  ],
} as const;

/** Niveau (NCLC pour le TCF, CLB pour l'IELTS) de chaque compétence. */
export function levels(exam: Lang, scores: Array<number | null>): Array<number | null> {
  return (exam === "tcf" ? TCF_SCALE : IELTS_SCALE).map((s, i) => level(s, scores[i]));
}

/** Niveau retenu = celui de la compétence la plus faible (null si une note manque). */
export function overallLevel(exam: Lang, scores: Array<number | null>): { level: number | null; weakest: number[] } {
  const lv = levels(exam, scores);
  const known = lv.filter((l): l is number => l != null);
  if (!known.length) return { level: null, weakest: [] };
  const min = Math.min(...known);
  return { level: lv.every((l) => l != null) ? min : null, weakest: lv.flatMap((l, i) => (l === min ? [i] : [])) };
}

export const TARGET_LEVEL: Record<Lang, number> = { tcf: 10, ielts: 9 };

export interface TrainingScore {
  id: string;
  exam: Lang;
  label: string;
  takenOn: string | null;
  scores: Array<number | null>;
  notes: string;
}

export const SCORE_PRESETS: Record<Lang, Array<{ label: string; date?: string }>> = {
  tcf: [
    { label: "Diagnostic" }, { label: "Examen blanc 1", date: "2026-11-28" }, { label: "Examen blanc 2", date: "2026-12-05" }, { label: "Examen blanc 3", date: "2026-12-12" }, { label: "Examen blanc 4", date: "2026-12-19" }, { label: "Examen blanc 5", date: "2026-12-26" }, { label: "Examen blanc 6", date: "2027-01-02" }, { label: "Examen blanc 7", date: "2027-01-09" }, { label: "Examen blanc 8", date: "2027-01-16" }, { label: "Examen blanc 9", date: "2027-01-23" }, { label: "Examen blanc 10", date: "2027-01-30" }, { label: "Examen blanc 11", date: "2027-02-06" },
    { label: "TCF Canada officiel", date: TCF_DATE },
  ],
  ielts: [{ label: "Diagnostic" }, { label: "Examen blanc 1", date: "2027-03-06" }, { label: "Examen blanc 2", date: "2027-03-20" }, { label: "IELTS officiel", date: IELTS_DATE }],
};

// ---------------------------------------------------------------- carnet d'erreurs

export interface ErrorEntry {
  id: string;
  exam: Lang;
  skill: string;
  wrong: string;
  correct: string;
  rule: string;
  count: number;
  mastered: boolean;
  createdAt: string;
}

/** Leçon de l'aide-mémoire (texte Markdown collé depuis un correcteur). */
export interface MemoEntry {
  id: string;
  exam: Lang;
  title: string;
  body: string;
  createdAt: string;
}

export const ERROR_SKILLS: Record<Lang, string[]> = {
  tcf: ["Expression écrite", "Expression orale", "Compréhension orale", "Compréhension écrite", "Grammaire", "Vocabulaire"],
  ielts: ["Writing", "Speaking", "Listening", "Reading", "Grammar", "Vocabulary"],
};

/** Seuil à partir duquel une erreur devient un exercice ciblé la semaine suivante. */
export const ERROR_REPEAT_THRESHOLD = 3;
