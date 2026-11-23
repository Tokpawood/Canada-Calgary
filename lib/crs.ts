/**
 * Score de classement global (CRS) d'Entrée express, candidat sans époux ni conjoint de fait.
 * C'est ce score qui décide de l'invitation ; la grille des 67 points ne fait que vérifier l'admissibilité.
 * Barème IRCC en vigueur depuis le 25 mars 2025 (plus de points pour une offre d'emploi). Aucune entrée/sortie.
 */
import type { FswProfile } from "./types";

type Four = [number, number, number, number];

/** Âge (candidat seul). */
export function crsAgePoints(age: number | null): number {
  if (age == null || age < 18 || age >= 45) return 0;
  if (age === 18) return 99;
  if (age === 19) return 105;
  if (age <= 29) return 110;
  return [105, 99, 94, 88, 83, 77, 72, 66, 61, 55, 50, 39, 28, 17, 6][age - 30];
}

/** Études (candidat seul), par code de niveau du profil. */
export const CRS_EDU: Record<string, number> = {
  "": 0,
  sec: 30,
  p1: 90,
  p2: 98,
  p3: 120,
  p2c: 128,
  ma: 135,
  phd: 150,
};

/** Première langue officielle, par épreuve (candidat seul). */
export function crsFirstLangPoints(clb: number): number {
  if (clb >= 10) return 34;
  if (clb === 9) return 31;
  if (clb === 8) return 23;
  if (clb === 7) return 17;
  if (clb === 6) return 9;
  if (clb >= 4) return 6;
  return 0;
}

/** Deuxième langue officielle, par épreuve (plafond 24 pour un candidat seul). */
export function crsSecondLangPoints(clb: number): number {
  if (clb >= 9) return 6;
  if (clb >= 7) return 3;
  if (clb >= 5) return 1;
  return 0;
}

export interface CrsInput {
  age: number | null;
  edu: string;
  /** NCLC par épreuve (CO, CE, EO, EE) en français et en anglais ; 0 = pas de test. */
  fr: Four;
  en: Four;
  /** Années d'expérience qualifiée à l'étranger (hors Canada). */
  foreignYears: number;
  /** Frère ou sœur au Canada, résident permanent ou citoyen. */
  sibling?: boolean;
}

export interface CrsResult {
  first: "fr" | "en";
  age: number;
  edu: number;
  lang1: number;
  lang2: number;
  core: number;
  transfer: number;
  transferEdu: number;
  transferWork: number;
  french: number;
  sibling: number;
  total: number;
}

const min4 = (s: Four) => Math.min(...s);
const sum = (s: Four, f: (n: number) => number) =>
  s.reduce((t, n) => t + f(n), 0);

export function crsCalc(i: CrsInput): CrsResult {
  // Langue première : celle qui rapporte le plus.
  const frPts = sum(i.fr, crsFirstLangPoints);
  const enPts = sum(i.en, crsFirstLangPoints);
  const first = frPts >= enPts ? "fr" : "en";
  const l1 = first === "fr" ? i.fr : i.en;
  const l2 = first === "fr" ? i.en : i.fr;

  const age = crsAgePoints(i.age);
  const edu = CRS_EDU[i.edu] ?? 0;
  const lang1 = sum(l1, crsFirstLangPoints);
  const lang2 = Math.min(24, sum(l2, crsSecondLangPoints));
  const core = age + edu + lang1 + lang2;

  // Transférabilité : études + langue, expérience étrangère + langue (50 chacun, 100 au total).
  const low = min4(l1);
  const tier = low >= 9 ? 2 : low >= 7 ? 1 : 0;
  const eduKind = ["p2c", "ma", "phd"].includes(i.edu)
    ? 2
    : ["p1", "p2", "p3"].includes(i.edu)
      ? 1
      : 0;
  const transferEdu =
    eduKind === 0 || tier === 0
      ? 0
      : eduKind === 1
        ? tier === 2
          ? 25
          : 13
        : tier === 2
          ? 50
          : 25;
  const workKind = i.foreignYears >= 3 ? 2 : i.foreignYears >= 1 ? 1 : 0;
  const transferWork =
    workKind === 0 || tier === 0
      ? 0
      : workKind === 1
        ? tier === 2
          ? 25
          : 13
        : tier === 2
          ? 50
          : 25;
  const transfer = Math.min(
    100,
    Math.min(50, transferEdu) + Math.min(50, transferWork),
  );

  // Points supplémentaires pour le français : NCLC 7 dans les 4 épreuves.
  const frOk = min4(i.fr) >= 7;
  const french = !frOk ? 0 : min4(i.en) >= 5 ? 50 : 25;
  const sibling = i.sibling ? 15 : 0;

  return {
    first,
    age,
    edu,
    lang1,
    lang2,
    core,
    transfer,
    transferEdu,
    transferWork,
    french,
    sibling,
    total: core + transfer + french + sibling,
  };
}

const scores = (fsw: FswProfile, l: "fr" | "en"): Four =>
  [fsw[`${l}_co`], fsw[`${l}_ce`], fsw[`${l}_eo`], fsw[`${l}_ee`]].map((v) =>
    Number(v || 0),
  ) as Four;

/** Entrée CRS à partir du profil enregistré (scores NCLC et études). */
export function crsFromProfile(
  fsw: FswProfile,
  age: number | null,
  foreignYears: number,
): CrsInput {
  return {
    age,
    edu: fsw.edu,
    fr: scores(fsw, "fr"),
    en: scores(fsw, "en"),
    foreignYears,
  };
}

/** Scénarios : niveau NCLC en français dans les 4 épreuves × niveau en anglais. */
export function crsScenarios(
  base: CrsInput,
  frLevels = [7, 9, 10],
  enLevels = [0, 5, 7, 9],
) {
  return frLevels.map((fr) => ({
    fr,
    cells: enLevels.map((en) => ({
      en,
      total: crsCalc({ ...base, fr: [fr, fr, fr, fr], en: [en, en, en, en] })
        .total,
    })),
  }));
}
