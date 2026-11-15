/**
 * Programme TCF Canada et IELTS General Training (16 novembre 2026 au 15 février 2027).
 * Données du programme et calcul du plan de chaque journée. Aucune entrée/sortie : tout est testable.
 */

export type Lang = "tcf" | "ielts";

export const PROGRAM_START = "2026-11-16";
export const PROGRAM_END = "2027-02-15";
export const IELTS_DATE = "2027-01-30";
export const TCF_DATE = "2027-02-15";
const SPRINT_IELTS = { from: "2027-01-19", to: "2027-01-29" };
const ALL_TCF_FROM = "2027-01-31";
export const NOTHING_NEW_AFTER = "2027-02-12";

export const TARGETS = {
  tcf: { label: "NCLC 10 dans les 4 compétences", comprehension: 549, expression: 16, training: { comprehension: 600, expression: 18 } },
  ielts: { label: "CLB 9", listening: 8, reading: 7, writing: 7, speaking: 7 },
};

export interface Phase {
  n: number;
  name: string;
  from: string;
  to: string;
  goal: string;
  change: string;
}

export const PHASES: Phase[] = [
  { n: 1, name: "Fondations", from: "2026-11-16", to: "2026-12-13", goal: "Diagnostic, structure des tâches, premières banques de phrases", change: "Ressources gratuites uniquement ; une copie corrigée tous les 2 jours" },
  { n: 2, name: "Intensif", from: "2026-12-14", to: "2027-01-18", goal: "16/20 en expression TCF, 6,5 à 7 en Writing IELTS", change: "Achat du pack Gold ; un examen blanc chaque samedi, TCF et IELTS en alternance" },
  { n: 3, name: "Sprint IELTS", from: "2027-01-19", to: "2027-01-30", goal: "CLB 9 le 30/01", change: "Toute la production en anglais ; le TCF reste en écoute pendant les trajets" },
  { n: 4, name: "Sprint TCF", from: "2027-01-31", to: "2027-02-15", goal: "18/20 en expression, 600 en compréhension", change: "Deux examens blancs complets ; rien de nouveau après le 12/02" },
];

export interface Send {
  label: string;
  subject?: string;
}

export interface Week {
  n: number;
  from: string;
  to: string;
  theme: string;
  grammar: string;
  ielts: string;
  goal: string;
  sends: Send[];
  saturday: { label: string; lang: Lang | null };
  note?: string;
}

const PACK = "Sujets du pack";

export const WEEKS: Week[] = [
  {
    n: 1, from: "2026-11-16", to: "2026-11-22", theme: "Travail et emploi", grammar: "Subjonctif après la volonté et le sentiment",
    ielts: "Format de l'IELTS General Training, types de lettres", goal: "Diagnostic écrit et oral",
    sends: [
      { label: "EE tâche 3", subject: "Télétravail" },
      { label: "Lettre IELTS", subject: "Lettre à M. Kouassi" },
      { label: "EO tâche 1", subject: "Votre présentation (parcours, métier, projets)" },
    ],
    saturday: { label: "Test diagnostic TCF (exemples officiels)", lang: "tcf" },
  },
  {
    n: 2, from: "2026-11-23", to: "2026-11-29", theme: "Technologie et numérique", grammar: "Subjonctif après « bien que », « pour que », « à moins que »",
    ielts: "Task 1 : lettre formelle", goal: "Identifier la compétence la plus faible",
    sends: [
      { label: "Scores du test diagnostic", subject: "Exemples officiels" },
      { label: "EE tâche 1", subject: "Message à un ami pour l'inviter" },
      { label: "EE tâche 2", subject: "Article sur une expérience marquante" },
      { label: "EO tâche 3", subject: "« Les réseaux sociaux rendent-ils les jeunes plus isolés ? »" },
    ],
    saturday: { label: "Test diagnostic IELTS (sujets officiels)", lang: "ielts" },
  },
  {
    n: 3, from: "2026-11-30", to: "2026-12-06", theme: "Environnement et climat", grammar: "Connecteurs d'opposition et de concession",
    ielts: "Task 1 : lettres semi-formelle et amicale", goal: "Maîtriser la structure de la tâche 3",
    sends: [
      { label: "EE tâche 3", subject: "Semaine de 4 jours" },
      { label: "EO tâche 2", subject: "Liste de 10 questions pour se renseigner sur un appartement" },
      { label: "Scores CO et CE" },
    ],
    saturday: { label: "Entraînement TCF : séries de CO et CE", lang: "tcf" },
  },
  {
    n: 4, from: "2026-12-07", to: "2026-12-13", theme: "Santé et alimentation", grammar: "Pronoms relatifs composés (dont, lequel, auquel)",
    ielts: "Task 2 : essai d'opinion", goal: "Registres et temps du passé sans faute",
    sends: [
      { label: "EE tâche 1", subject: "Réclamation à un service client" },
      { label: "EE tâche 2", subject: "Récit d'un voyage" },
      { label: "EO tâche 3", subject: "« L'IA va-t-elle remplacer les recruteurs ? »" },
    ],
    saturday: { label: "Entraînement IELTS : Listening et Reading", lang: "ielts" },
  },
  {
    n: 5, from: "2026-12-14", to: "2026-12-20", theme: "Éducation et formation", grammar: "Hypothèse : si + imparfait ou plus-que-parfait, conditionnel passé",
    ielts: "Reading : sections 1 et 2", goal: "Premier score de référence en conditions réelles",
    sends: [
      { label: "Achat du pack Gold (49,99 $ US)", subject: "formation-tcfcanada.com" },
      { label: "Examen blanc n° 1 (CO, CE et EE) : scores et copies", subject: PACK },
    ],
    saturday: { label: "Examen blanc TCF n° 1 (CO, CE et EE)", lang: "tcf" },
  },
  {
    n: 6, from: "2026-12-21", to: "2026-12-27", theme: "Famille et société", grammar: "Accords du participe passé",
    ielts: "Listening : parts 1 et 2", goal: "Garder le rythme",
    sends: [{ label: "EE tâche 3 uniquement", subject: "Gratuité des transports publics" }],
    saturday: { label: "Examen blanc IELTS n° 1", lang: "ielts" },
    note: "Semaine de la cérémonie et des fêtes : seule la tâche 3 écrite est à envoyer.",
  },
  {
    n: 7, from: "2026-12-28", to: "2027-01-03", theme: "Ville, transports, logement", grammar: "Nominalisation et voix passive",
    ielts: "Task 2 : essais discussion et problème-solution", goal: "Vocabulaire de la nuance et connecteurs",
    sends: [
      { label: "EE tâche 1", subject: PACK },
      { label: "EE tâche 2", subject: PACK },
      { label: "EO tâche 3", subject: "« Faut-il interdire la voiture en centre-ville ? »" },
    ],
    saturday: { label: "Entraînement IELTS : Writing Task 1 et Task 2", lang: "ielts" },
  },
  {
    n: 8, from: "2027-01-04", to: "2027-01-10", theme: "Consommation et économie", grammar: "Gérondif et participe présent",
    ielts: "Speaking Part 2 (cue cards)", goal: "16/20 en EE",
    sends: [
      { label: "Inscription au TCF Canada (le 05/01)", subject: "Examen du 15/02/2027" },
      { label: "Examen blanc n° 2 : scores et copies", subject: PACK },
      { label: "Essai IELTS (Task 2)", subject: "Sujet IELTS au choix" },
    ],
    saturday: { label: "Examen blanc TCF n° 2", lang: "tcf" },
  },
  {
    n: 9, from: "2027-01-11", to: "2027-01-17", theme: "Immigration et diversité", grammar: "Discours rapporté et concordance des temps",
    ielts: "Listening parts 3 et 4, Reading section 3", goal: "16/20 en EO",
    sends: [
      { label: "EO : les 3 tâches en conditions réelles", subject: PACK },
      { label: "EE tâche 3", subject: "Immigration et pénurie de main-d'œuvre" },
      { label: "Lettre IELTS (Task 1)" },
    ],
    saturday: { label: "Examen blanc TCF n° 3", lang: "tcf" },
  },
  {
    n: 10, from: "2027-01-18", to: "2027-01-24", theme: "Médias et information", grammar: "Mise en relief, négations complexes",
    ielts: "Sprint IELTS : examens blancs complets", goal: "Stabiliser 549 ou plus en CO et CE",
    sends: [
      { label: "Examen blanc n° 3 : scores", subject: PACK },
      { label: "IELTS Speaking Part 2 (transcription)", subject: "Sujet IELTS" },
    ],
    saturday: { label: "Examen blanc IELTS n° 2 (complet)", lang: "ielts" },
  },
  {
    n: 11, from: "2027-01-25", to: "2027-01-31", theme: "Culture, loisirs, tourisme", grammar: "Révision des registres (formel, courant, familier)",
    ielts: "IELTS le 30/01", goal: "Réussir l'IELTS sans perdre le fil du TCF",
    sends: [
      { label: "Un essai IELTS avant le 30/01", subject: "Sujet IELTS" },
      { label: "Un oral IELTS avant le 30/01", subject: "Sujet IELTS" },
      { label: "Reprise du TCF après l'IELTS" },
    ],
    saturday: { label: "Reprise TCF : séries de CO et CE", lang: "tcf" },
  },
  {
    n: 12, from: "2027-02-01", to: "2027-02-07", theme: "Sport et bien-être", grammar: "Révision générale et erreurs fréquentes",
    ielts: "—", goal: "Simulation finale à 18/20 et 600",
    sends: [
      { label: "Examen blanc n° 4 complet", subject: "Idéalement à l'Institut français" },
      { label: "EE complète", subject: "Sujets de l'examen blanc" },
      { label: "EO complète", subject: "Sujets de l'examen blanc" },
    ],
    saturday: { label: "Examen blanc TCF n° 4 complet (idéalement à l'Institut français)", lang: "tcf" },
  },
  {
    n: 13, from: "2027-02-08", to: "2027-02-14", theme: "Révision de tous les thèmes", grammar: "Carnet d'erreurs uniquement",
    ielts: "—", goal: "Repos actif, rien de nouveau après le 12/02",
    sends: [
      { label: "EE tâche 3 le mardi", subject: PACK },
      { label: "Relecture du carnet d'erreurs" },
    ],
    saturday: { label: "Repos actif : relecture du carnet d'erreurs", lang: null },
    note: "Rien de nouveau après le 12/02.",
  },
];

/** Tâches datées rattachées à un envoi de la semaine (même clé : cocher l'un coche l'autre). */
const DATED_SENDS: Record<string, string> = { "2026-12-14": "s5:e0", "2027-01-05": "s8:e0", "2027-02-09": "s13:e0" };

export const sendKey = (week: number, i: number) => `s${week}:e${i}`;

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

export function weekOf(iso: string): Week | null {
  return WEEKS.find((w) => iso >= w.from && iso <= w.to) ?? null;
}

export function phaseOf(iso: string): Phase | null {
  return PHASES.find((p) => iso >= p.from && iso <= p.to) ?? null;
}

/** Toutes les dates du programme, du premier au dernier jour. */
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
}

export interface DayPlan {
  date: string;
  week: Week | null;
  phase: Phase | null;
  /** Langue dominante de la journée (production) ; null le week-end. */
  lang: Lang | null;
  kind: "semaine" | "samedi" | "dimanche" | "examen";
  title: string;
  items: DayItem[];
  tip?: string;
}

interface SlotDef {
  id: string;
  time: string;
  minutes: number;
  group: SlotGroup;
  /** Créneau de trajet (écoute) : reste en TCF pendant le sprint IELTS. */
  commute: boolean;
  tcf: (w: Week) => string;
  ielts: (w: Week) => string;
}

const WEEKDAY_SLOTS: SlotDef[] = [
  { id: "am", time: "05:15", minutes: 45, group: "matin", commute: false, tcf: () => "Expression écrite TCF chronométrée (tâche du jour)", ielts: () => "Writing IELTS chronométré (Task 1 ou Task 2)" },
  { id: "t1", time: "Trajet aller", minutes: 30, group: "trajet", commute: true, tcf: () => "Exercices de compréhension orale TCF sur téléphone", ielts: () => "IELTS Listening (une section)" },
  { id: "t2", time: "Trajet aller", minutes: 60, group: "trajet", commute: true, tcf: () => "Podcast français de niveau C2", ielts: () => "Podcast anglais" },
  { id: "t3", time: "Trajet aller", minutes: 20, group: "trajet", commute: true, tcf: (w) => `Anki : vocabulaire français « ${w.theme} »`, ielts: () => "Anki : vocabulaire anglais" },
  { id: "midi", time: "Pause déjeuner", minutes: 20, group: "midi", commute: false, tcf: () => "Un texte de compréhension écrite TCF", ielts: () => "Un passage de Reading IELTS" },
  { id: "t4", time: "Trajet retour", minutes: 90, group: "trajet", commute: true, tcf: () => "Podcast français et relecture mentale du carnet d'erreurs", ielts: () => "Podcast anglais" },
  { id: "pm", time: "20:30", minutes: 45, group: "soir", commute: false, tcf: () => "Expression orale TCF : s'enregistrer, transcrire, corriger", ielts: () => "IELTS Speaking : s'enregistrer sur une Part 2 ou 3" },
  { id: "fin", time: "21:15", minutes: 15, group: "soir", commute: false, tcf: () => "Carnet d'erreurs, puis lecture du sujet du lendemain", ielts: () => "Carnet d'erreurs, puis lecture du sujet du lendemain" },
];

/** Langue d'un créneau de semaine selon la date (règles de phase incluses). */
export function slotLang(iso: string, commute: boolean): Lang {
  if (iso >= ALL_TCF_FROM) return "tcf";
  if (iso >= SPRINT_IELTS.from && iso <= SPRINT_IELTS.to) return commute ? "tcf" : "ielts";
  const d = weekday(iso);
  return d === 2 || d === 4 ? "ielts" : "tcf";
}

const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function dayPlan(iso: string): DayPlan | null {
  if (!inProgram(iso)) return null;
  const week = weekOf(iso);
  const phase = phaseOf(iso);
  const d = weekday(iso);
  const k = (id: string) => `${iso}:${id}`;

  if (iso === IELTS_DATE) {
    return {
      date: iso, week, phase, lang: "ielts", kind: "examen", title: "Jour de l'IELTS General Training",
      items: [{ key: k("examen"), time: "Journée", minutes: null, label: "Passer l'IELTS General Training", detail: "Objectif CLB 9 : Listening 8,0 ; Reading 7,0 ; Writing 7,0 ; Speaking 7,0", lang: "ielts", group: "examen" }],
      tip: "Writing : commencez par la Task 2, qui compte double.",
    };
  }
  if (iso === TCF_DATE) {
    return {
      date: iso, week, phase, lang: "tcf", kind: "examen", title: "Jour du TCF Canada",
      items: [{ key: k("examen"), time: "Journée", minutes: null, label: "Passer le TCF Canada", detail: "Objectif NCLC 10 : 549 en compréhension, 16/20 en expression", lang: "tcf", group: "examen" }],
      tip: "Lisez les réponses proposées avant d'écouter ou de lire le document.",
    };
  }
  if (!week) return null;

  const dated: DayItem[] = [];
  const sendRef = DATED_SENDS[iso];
  if (sendRef) {
    const [, e] = sendRef.split(":");
    const s = week.sends[Number(e.slice(1))];
    if (s) dated.push({ key: sendRef, time: "À faire", minutes: null, label: s.label, detail: s.subject, lang: null, group: "jalon" });
  }

  if (d === 6) {
    const items: DayItem[] = [...dated];
    if (week.saturday.lang) {
      items.push({ key: k("blanc"), time: "08:00", minutes: 180, label: week.saturday.label, detail: "En conditions réelles, chronomètre lancé", lang: week.saturday.lang, group: "weekend" });
      items.push({ key: k("correction"), time: "15:00", minutes: 60, label: "Correction de l'examen blanc et carnet d'erreurs", lang: week.saturday.lang, group: "weekend" });
    } else {
      items.push({ key: k("carnet"), time: "Matin", minutes: 60, label: week.saturday.label, lang: "tcf", group: "weekend" });
    }
    return { date: iso, week, phase, lang: null, kind: "samedi", title: `Samedi · ${week.saturday.lang ? "examen blanc" : "repos actif"}`, items };
  }

  if (d === 7) {
    return {
      date: iso, week, phase, lang: null, kind: "dimanche", title: "Dimanche · grammaire et bilan",
      items: [
        ...dated,
        { key: k("grammaire"), time: "15:00", minutes: 60, label: `Grammaire de la semaine : ${week.grammar}`, lang: "tcf", group: "weekend" },
        { key: k("shadowing"), time: "16:00", minutes: 30, label: "Shadowing : répéter à voix haute un extrait audio", lang: null, group: "weekend" },
        { key: k("bilan"), time: "20:00", minutes: null, label: "Envoyer le bilan de la semaine à Claude (scores et copies)", detail: "Relire aussi le carnet d'erreurs", lang: null, group: "weekend" },
      ],
      tip: "Une erreur qui revient 3 fois devient un exercice ciblé la semaine suivante.",
    };
  }

  const items: DayItem[] = [
    ...dated,
    ...WEEKDAY_SLOTS.map((s) => {
      const lang = slotLang(iso, s.commute);
      return { key: k(s.id), time: s.time, minutes: s.minutes, label: lang === "tcf" ? s.tcf(week) : s.ielts(week), lang, group: s.group };
    }),
  ];
  const lang = slotLang(iso, false);
  return {
    date: iso, week, phase, lang, kind: "semaine", title: `${DAY_NAMES[d]} · jour ${lang === "tcf" ? "TCF" : "IELTS"}`, items,
    tip: iso > NOTHING_NEW_AFTER ? "Rien de nouveau : relisez le carnet d'erreurs." : "Si vous partez avant 6 h, faites l'écriture du matin à 20:30 et l'oral en 15 minutes juste après.",
  };
}

export function dayName(iso: string): string {
  return DAY_NAMES[weekday(iso)];
}

/** Clés de toutes les tâches d'une semaine : créneaux des 7 jours + envois. */
export function weekKeys(w: Week): string[] {
  const keys = new Set<string>();
  for (let d = w.from; d <= w.to; d = addDays(d, 1)) dayPlan(d)?.items.forEach((i) => keys.add(i.key));
  w.sends.forEach((_, i) => keys.add(sendKey(w.n, i)));
  return [...keys];
}

export function allKeys(): string[] {
  const keys = new Set<string>();
  for (const d of programDays()) dayPlan(d)?.items.forEach((i) => keys.add(i.key));
  for (const w of WEEKS) w.sends.forEach((_, i) => keys.add(sendKey(w.n, i)));
  return [...keys];
}

/** Clés des jours passés et du jour donné (pour mesurer le retard). */
export function keysUntil(iso: string): string[] {
  const keys = new Set<string>();
  for (const d of programDays()) {
    if (d > iso) break;
    dayPlan(d)?.items.forEach((i) => keys.add(i.key));
  }
  return [...keys];
}

/** Jours consécutifs entièrement faits, en remontant depuis hier (aujourd'hui compte s'il est complet). */
export function streak(today: string, done: Set<string>): number {
  let n = 0;
  let d = clampToProgram(today);
  const full = (iso: string) => {
    const p = dayPlan(iso);
    return !!p && p.items.length > 0 && p.items.every((i) => done.has(i.key));
  };
  if (!full(d)) d = addDays(d, -1);
  while (d >= PROGRAM_START && full(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ---------------------------------------------------------------- niveaux NCLC / CLB

type Scale = Array<[number, number]>; // [seuil minimal, niveau], du plus haut au plus bas

const TCF_SCALE: Record<"co" | "ce" | "ee" | "eo", Scale> = {
  co: [[549, 10], [523, 9], [503, 8], [458, 7], [398, 6], [369, 5], [331, 4]],
  ce: [[549, 10], [524, 9], [499, 8], [453, 7], [406, 6], [375, 5], [342, 4]],
  ee: [[16, 10], [14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]],
  eo: [[16, 10], [14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]],
};

const IELTS_SCALE: Record<"l" | "r" | "w" | "s", Scale> = {
  l: [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]],
  r: [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]],
  w: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]],
  s: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]],
};

function level(scale: Scale, v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  for (const [min, lvl] of scale) if (v >= min) return lvl;
  return 0;
}

export const SKILLS = {
  tcf: [
    { id: "co", label: "CO", name: "Compréhension orale", max: 699, step: 1 },
    { id: "ce", label: "CE", name: "Compréhension écrite", max: 699, step: 1 },
    { id: "ee", label: "EE", name: "Expression écrite", max: 20, step: 1 },
    { id: "eo", label: "EO", name: "Expression orale", max: 20, step: 1 },
  ],
  ielts: [
    { id: "l", label: "Listening", name: "Listening", max: 9, step: 0.5 },
    { id: "r", label: "Reading", name: "Reading", max: 9, step: 0.5 },
    { id: "w", label: "Writing", name: "Writing", max: 9, step: 0.5 },
    { id: "s", label: "Speaking", name: "Speaking", max: 9, step: 0.5 },
  ],
} as const;

/** Niveau (NCLC pour le TCF, CLB pour l'IELTS) de chaque compétence. */
export function levels(exam: Lang, scores: Array<number | null>): Array<number | null> {
  const scales = exam === "tcf" ? [TCF_SCALE.co, TCF_SCALE.ce, TCF_SCALE.ee, TCF_SCALE.eo] : [IELTS_SCALE.l, IELTS_SCALE.r, IELTS_SCALE.w, IELTS_SCALE.s];
  return scales.map((s, i) => level(s, scores[i]));
}

/** Niveau retenu = celui de la compétence la plus faible (null si une note manque). */
export function overallLevel(exam: Lang, scores: Array<number | null>): { level: number | null; weakest: number[] } {
  const lv = levels(exam, scores);
  const known = lv.filter((l): l is number => l != null);
  if (!known.length) return { level: null, weakest: [] };
  const min = Math.min(...known);
  return { level: lv.every((l) => l != null) ? min : null, weakest: lv.flatMap((l, i) => (l === min ? [i] : [])) };
}

/** Cible de niveau : 10 au TCF, 9 à l'IELTS. */
export const TARGET_LEVEL: Record<Lang, number> = { tcf: 10, ielts: 9 };

export interface TrainingScore {
  id: string;
  exam: Lang;
  label: string;
  takenOn: string | null;
  scores: Array<number | null>;
  notes: string;
}

export const SCORE_PRESETS: Record<Lang, string[]> = {
  tcf: ["Diagnostic", "Examen blanc 1", "Examen blanc 2", "Examen blanc 3", "Examen blanc 4", "TCF Canada officiel"],
  ielts: ["Diagnostic", "Examen blanc 1", "Examen blanc 2", "IELTS officiel"],
};
