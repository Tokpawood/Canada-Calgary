/**
 * Étapes de la procédure (Entrée express, travailleurs qualifiés fédéraux, d'Abidjan à Calgary)
 * et classement des pièces dans ces étapes. Aucune entrée/sortie : tout est testable.
 */
import type { DocumentRecord } from "./types";
import { normalizeSearch } from "./documents";

export const DOCUMENT_STAGES = [
  {
    id: "identite",
    title: "Identité et état civil",
    when: "Dès maintenant",
    desc: "La base de toutes les démarches : les noms, dates et lieux doivent être identiques partout.",
  },
  {
    id: "langues",
    title: "Tests de langue",
    when: "Avant le profil",
    desc: "TCF Canada et IELTS General Training : résultats valables 2 ans, à saisir dans le profil.",
  },
  {
    id: "etudes",
    title: "Études et évaluation des diplômes",
    when: "Avant le profil",
    desc: "Diplômes et relevés envoyés à WES pour l'évaluation des diplômes d'études (EDE), valable 5 ans.",
  },
  {
    id: "experience",
    title: "Expérience de travail",
    when: "Avant le profil",
    desc: "Lettres de référence détaillées (poste, tâches, heures, salaire, dates) et preuves complémentaires.",
  },
  {
    id: "fonds",
    title: "Preuve de fonds",
    when: "Profil, demande et arrivée",
    desc: "Fonds disponibles et transférables au barème en vigueur, à prouver jusqu'à l'arrivée.",
  },
  {
    id: "demande",
    title: "Demande de résidence permanente",
    when: "60 jours après l'invitation",
    desc: "Pièces à téléverser après l'invitation à présenter une demande, puis biométrie et visite médicale.",
  },
  {
    id: "arrivee",
    title: "Visa et arrivée",
    when: "Après l'approbation",
    desc: "Confirmation de résidence permanente, visa et papiers à présenter à l'agent frontalier.",
  },
  {
    id: "installation",
    title: "Installation à Calgary",
    when: "Premières semaines",
    desc: "Documents obtenus sur place : à prévoir dès l'arrivée.",
  },
] as const;

export type DocumentStage = (typeof DOCUMENT_STAGES)[number]["id"];
export const STAGE_IDS = DOCUMENT_STAGES.map((s) => s.id) as DocumentStage[];

export const isStage = (s: string): s is DocumentStage =>
  (STAGE_IDS as string[]).includes(s);

/** Mots qui placent une pièce non classée dans une étape (dans cet ordre : le premier trouvé gagne). */
const GUESS: Array<[DocumentStage, RegExp]> = [
  [
    "arrivee",
    /confirmation de (rp|residence)|\bcopr\b|visa|biens|\bb4\b|permis.*international|historique de conduite|releve.*conduite/,
  ],
  [
    "installation",
    /\bnas\b|assurance sociale|ahcip|carte sante|alberta|carte de resident|carte rp/,
  ],
  ["langues", /\btcf\b|ielts|\btef\b|celpip|langue/],
  [
    "etudes",
    /diplome|releves? de notes|\bwes\b|\bede\b|bts|bachelor|licence|master|baccalaureat|college|universit/,
  ],
  [
    "experience",
    /reference|contrat|certificat de travail|paie|employeur|experience|attestation de travail/,
  ],
  ["fonds", /banc|fonds|releves? de compte|epargne/],
  [
    "demande",
    /casier|police|medical|medicale|historique|photo|biometri|imm ?\d|formulaire|frais|lettre explicative/,
  ],
  [
    "identite",
    /passeport|identite|naissance|nationalite|mariage|etat civil|enrolement/,
  ],
];

export function guessStage(name: string): DocumentStage | null {
  const n = normalizeSearch(name);
  for (const [stage, re] of GUESS) if (re.test(n)) return stage;
  return null;
}

/** Étape d'une pièce : celle choisie, sinon devinée d'après son nom (null : à classer). */
export function stageOf(
  d: Pick<DocumentRecord, "stage" | "name">,
): DocumentStage | null {
  return d.stage && isStage(d.stage) ? d.stage : guessStage(d.name);
}

const REQ_RANK = { Obligatoire: 0, Conseillé: 1, "Si applicable": 2 } as const;

/** Pièces regroupées par étape, dans l'ordre de la procédure ; obligatoires d'abord, puis rang. */
export function groupByStage<
  T extends Pick<DocumentRecord, "stage" | "name" | "req" | "position">,
>(
  docs: T[],
): Array<{ stage: (typeof DOCUMENT_STAGES)[number] | null; docs: T[] }> {
  const sort = (a: T, b: T) =>
    REQ_RANK[a.req] - REQ_RANK[b.req] || a.position - b.position;
  const out: Array<{
    stage: (typeof DOCUMENT_STAGES)[number] | null;
    docs: T[];
  }> = DOCUMENT_STAGES.map((stage) => ({
    stage,
    docs: docs.filter((d) => stageOf(d) === stage.id).sort(sort),
  }));
  const loose = docs.filter((d) => stageOf(d) === null).sort(sort);
  if (loose.length) out.push({ stage: null, docs: loose });
  return out.filter((g) => g.docs.length > 0);
}
