/**
 * Objectif commun de toute l'application : la résidence permanente par Entrée express (travailleurs
 * qualifiés fédéraux) et l'installation à Calgary. Les 5 phases du Parcours servent de colonne vertébrale ;
 * chaque onglet y contribue (pièces, budget, épargne, profil, contacts, coffre) et ce module calcule,
 * pour chacun, ce qui reste à régler dans la phase en cours et la suivante. Aucune entrée/sortie.
 */
import type { DocumentStage } from "./documentStages";
import { stageOf } from "./documentStages";

export const PROCEDURE_GOAL = {
  title: "Résidence permanente par Entrée express",
  sub: "Travailleurs qualifiés (fédéral) · installation à Calgary",
} as const;

export interface PhaseMeta {
  n: number;
  title: string;
  /** Ce qui doit être vrai à la fin de la phase. */
  goal: string;
  /** Étapes de pièces (onglet Documents) à boucler pendant la phase. */
  docStages: DocumentStage[];
}

export const PHASES: PhaseMeta[] = [
  {
    n: 1,
    title: "Mise en ordre",
    goal: "Passeport et état civil identiques partout, diplômes en main, préparation aux tests lancée.",
    docStages: ["identite"],
  },
  {
    n: 2,
    title: "Tests et preuves",
    goal: "TCF Canada et IELTS au niveau visé, rapport WES, lettres de référence et historique complet.",
    docStages: ["langues", "etudes", "experience"],
  },
  {
    n: 3,
    title: "Profil et invitation",
    goal: "Fonds réunis, profil Entrée express créé sans erreur, invitation reçue.",
    docStages: ["fonds"],
  },
  {
    n: 4,
    title: "Demande de résidence",
    goal: "Demande complète déposée dans les 60 jours, biométrie et visite médicale faites, visa reçu.",
    docStages: ["demande"],
  },
  {
    n: 5,
    title: "Installation à Calgary",
    goal: "Arrivée, RP confirmée à la frontière, NAS, carte santé, logement et emploi.",
    docStages: ["arrivee", "installation"],
  },
];

/** Numéro de phase d'après le libellé du Parcours (« 2. Tests et preuves » → 2). */
export function phaseNumber(phase: string): number | null {
  const m = /^\s*(\d)/.exec(phase);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= PHASES.length ? n : null;
}

export function phaseOfStage(stage: DocumentStage | null): number | null {
  if (!stage) return null;
  return PHASES.find((p) => p.docStages.includes(stage))?.n ?? null;
}

export type ProcedureTab =
  | "parcours"
  | "documents"
  | "budget"
  | "epargne"
  | "profil"
  | "contacts"
  | "coffre";

/** Ce que chaque onglet apporte à l'objectif. */
export const TAB_ROLE: Record<ProcedureTab, string> = {
  parcours:
    "Le plan : chaque étape de la procédure, ses échéances et ses mini-étapes.",
  documents:
    "Les preuves : chaque pièce exigée par IRCC, obtenue, contrôlée et numérisée à temps.",
  budget:
    "Le coût : ce que coûte chaque phase, prévu et dépensé, pour ne jamais bloquer faute d'argent.",
  epargne:
    "Les fonds : le minimum exigé par IRCC, à prouver du profil jusqu'à l'arrivée.",
  profil:
    "Le dossier : identité, historique sans trou, grille des travailleurs qualifiés et contrôle du dossier.",
  contacts:
    "Les interlocuteurs : qui relancer pour obtenir chaque pièce et franchir chaque étape.",
  coffre:
    "Les originaux numérisés : chaque pièce prête à téléverser sur le portail IRCC.",
};

export interface ProcStep {
  id: string;
  phase: string;
  title: string;
  status: string;
  due: string | null;
  planned: number | null;
  actual: number | null;
}
export interface ProcDoc {
  id: string;
  name: string;
  stage: string;
  req: string;
  status: string;
  /** Scans actifs déposés au coffre. */
  scans: number;
}
export interface ProcContact {
  id: string;
  org: string;
  stage: string;
}

export interface ProcAlert {
  tab: ProcedureTab;
  level: "hi" | "md" | "lo";
  text: string;
}

export interface PhaseState extends PhaseMeta {
  done: number;
  total: number;
  from: string | null;
  to: string | null;
  state: "fait" | "en-cours" | "a-venir";
}

export interface Procedure {
  phases: PhaseState[];
  current: number;
  alerts: ProcAlert[];
}

const OPEN = (s: string) => s !== "Fait" && s !== "Si nécessaire";
const fmt = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")} F`;
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};
const months = (from: string, to: string) => {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

export function buildProcedure(input: {
  steps: ProcStep[];
  docs: ProcDoc[];
  contacts: ProcContact[];
  /** Liens contact → étape (table contact_step). */
  contactSteps: Array<{ contact_id: string; step_id: string }>;
  saved: number;
  fundsMin: number;
  today: string;
}): Procedure {
  const { steps, docs, today } = input;
  const phases: PhaseState[] = PHASES.map((p) => {
    const own = steps.filter((s) => phaseNumber(s.phase) === p.n);
    const dues = own
      .map((s) => s.due)
      .filter((d): d is string => !!d)
      .sort();
    const counted = own.filter((s) => s.status !== "Si nécessaire");
    const done = counted.filter((s) => s.status === "Fait").length;
    return {
      ...p,
      done,
      total: counted.length,
      from: dues[0] ?? null,
      to: dues.at(-1) ?? null,
      state: "a-venir" as const,
    };
  });
  // Phase en cours : la première qui a encore une étape ouverte.
  const current = phases.find((p) => p.done < p.total)?.n ?? PHASES.length;
  for (const p of phases)
    p.state = p.n < current ? "fait" : p.n === current ? "en-cours" : "a-venir";

  const alerts: ProcAlert[] = [];
  const focus = [current, current + 1].filter((n) => n <= PHASES.length);
  const phaseName = (n: number) => `phase ${n} (${PHASES[n - 1].title})`;

  // Parcours : retards et échéances de la phase en cours.
  const late = steps.filter((s) => OPEN(s.status) && s.due && s.due < today);
  if (late.length)
    alerts.push({
      tab: "parcours",
      level: "hi",
      text: `${late.length} étape${late.length > 1 ? "s" : ""} en retard : ${late
        .slice(0, 2)
        .map((s) => s.title)
        .join(", ")}${late.length > 2 ? "…" : ""}`,
    });
  const nextOpen = steps
    .filter(
      (s) =>
        phaseNumber(s.phase) === current &&
        OPEN(s.status) &&
        s.due &&
        s.due >= today,
    )
    .sort((a, b) => a.due!.localeCompare(b.due!))[0];
  if (nextOpen)
    alerts.push({
      tab: "parcours",
      level: "lo",
      text: `Prochaine échéance de la ${phaseName(current)} : ${nextOpen.title}, le ${fmtDay(nextOpen.due!)}`,
    });

  // Documents : pièces obligatoires des phases en cours et suivante.
  for (const n of focus) {
    const missing = docs.filter(
      (d) =>
        d.req === "Obligatoire" &&
        d.status !== "Obtenu" &&
        phaseOfStage(stageOf(d)) === n,
    );
    if (missing.length)
      alerts.push({
        tab: "documents",
        level: n === current ? "hi" : "md",
        text: `${missing.length} pièce${missing.length > 1 ? "s" : ""} obligatoire${missing.length > 1 ? "s" : ""} à obtenir pour la ${phaseName(n)} : ${missing
          .slice(0, 3)
          .map((d) => d.name)
          .join(", ")}${missing.length > 3 ? "…" : ""}`,
      });
  }

  // Coffre : pièces obtenues sans scan (à téléverser sur le portail IRCC le moment venu).
  const unscanned = docs.filter((d) => d.status === "Obtenu" && d.scans === 0);
  if (unscanned.length)
    alerts.push({
      tab: "coffre",
      level: "md",
      text: `${unscanned.length} pièce${unscanned.length > 1 ? "s" : ""} obtenue${unscanned.length > 1 ? "s" : ""} sans scan : ${unscanned
        .slice(0, 3)
        .map((d) => d.name)
        .join(", ")}${unscanned.length > 3 ? "…" : ""}`,
    });
  const obtained = docs.filter((d) => d.status === "Obtenu").length;
  if (obtained)
    alerts.push({
      tab: "coffre",
      level: "lo",
      text: `${obtained - unscanned.length}/${obtained} pièces obtenues numérisées.`,
    });

  // Budget : coût de la phase en cours et de la suivante.
  for (const n of focus) {
    const own = steps.filter(
      (s) => phaseNumber(s.phase) === n && s.status !== "Si nécessaire",
    );
    const planned = own.reduce((t, s) => t + (s.planned ?? 0), 0);
    const spent = own.reduce((t, s) => t + (s.actual ?? 0), 0);
    if (!planned && !spent) continue;
    const over = spent > planned && planned > 0;
    alerts.push({
      tab: "budget",
      level: over ? "hi" : n === current ? "md" : "lo",
      text: over
        ? `Phase ${n} (${PHASES[n - 1].title}) : ${fmt(spent)} dépensés pour ${fmt(planned)} prévus (dépassement de ${fmt(spent - planned)})`
        : `Phase ${n} (${PHASES[n - 1].title}) : ${fmt(planned)} prévus, ${fmt(spent)} dépensés${planned > spent ? `, ${fmt(planned - spent)} encore à payer` : ""}`,
    });
  }

  // Épargne : fonds minimum IRCC à réunir avant le profil (phase 3).
  if (input.fundsMin > 0) {
    const short = input.fundsMin - input.saved;
    const p3 = phases[2];
    const deadline =
      steps.find((s) => phaseNumber(s.phase) === 3 && /fonds/i.test(s.title))
        ?.due ?? p3.from;
    if (short > 0) {
      const left = deadline ? Math.max(1, months(today, deadline)) : null;
      alerts.push({
        tab: "epargne",
        level: deadline && deadline < today ? "hi" : "md",
        text: `Fonds IRCC : ${fmt(input.saved)} sur ${fmt(input.fundsMin)}, encore ${fmt(short)}${deadline ? ` d'ici le ${fmtDay(deadline)}${left ? `, soit environ ${fmt(short / left)} par mois` : ""}` : ""}`,
      });
    } else
      alerts.push({
        tab: "epargne",
        level: "lo",
        text: `Fonds IRCC atteints : ${fmt(input.saved)} pour ${fmt(input.fundsMin)} exigés. À garder jusqu'à l'arrivée.`,
      });
  }

  // Contacts : organismes encore à contacter pour les étapes des phases en cours et suivante.
  const stepPhase = new Map(steps.map((s) => [s.id, phaseNumber(s.phase)]));
  const openStep = new Set(
    steps.filter((s) => OPEN(s.status)).map((s) => s.id),
  );
  const toCall = input.contacts.filter(
    (c) =>
      c.stage === "a-contacter" &&
      input.contactSteps.some(
        (l) =>
          l.contact_id === c.id &&
          openStep.has(l.step_id) &&
          focus.includes(stepPhase.get(l.step_id) ?? 0),
      ),
  );
  if (toCall.length)
    alerts.push({
      tab: "contacts",
      level: "md",
      text: `${toCall.length} organisme${toCall.length > 1 ? "s" : ""} à contacter pour les phases ${focus.join(" et ")} : ${toCall
        .slice(0, 3)
        .map((c) => c.org)
        .join(", ")}${toCall.length > 3 ? "…" : ""}`,
    });
  const waiting = input.contacts.filter((c) => c.stage === "en-attente").length;
  if (waiting)
    alerts.push({
      tab: "contacts",
      level: "lo",
      text: `${waiting} réponse${waiting > 1 ? "s" : ""} attendue${waiting > 1 ? "s" : ""} : pensez à relancer.`,
    });

  return { phases, current, alerts };
}
