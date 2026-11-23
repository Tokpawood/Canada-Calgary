import { describe, expect, it } from "vitest";
import { buildProcedure, phaseNumber, phaseOfStage } from "./procedure";

const step = (
  id: string,
  phase: string,
  status: string,
  due: string | null,
  planned: number | null = null,
  actual: number | null = null,
  title = id,
) => ({
  id,
  phase,
  title,
  status,
  due,
  planned,
  actual,
});

const base = {
  steps: [
    step("a", "1. Mise en ordre", "Fait", "2026-11-12", 40000, 40000),
    step(
      "b",
      "1. Mise en ordre",
      "En cours",
      "2026-12-03",
      75000,
      0,
      "Retirer le passeport",
    ),
    step(
      "c",
      "2. Tests et preuves",
      "À faire",
      "2027-01-05",
      170000,
      null,
      "S'inscrire au TCF",
    ),
    step("d", "2. Tests et preuves", "Si nécessaire", "2027-03-31", 170000),
    step(
      "f",
      "3. Profil et invitation",
      "En cours",
      "2027-05-15",
      null,
      null,
      "Réunir les fonds d'installation",
    ),
  ],
  docs: [
    {
      id: "p",
      name: "Passeport",
      stage: "identite",
      req: "Obligatoire",
      status: "Demandé",
      scans: 0,
    },
    {
      id: "t",
      name: "Résultats TCF Canada",
      stage: "langues",
      req: "Obligatoire",
      status: "À obtenir",
      scans: 0,
    },
    {
      id: "n",
      name: "Extrait d'acte de naissance",
      stage: "identite",
      req: "Obligatoire",
      status: "Obtenu",
      scans: 0,
    },
  ],
  contacts: [
    { id: "ifci", org: "Institut français", stage: "a-contacter" },
    { id: "irc", org: "IRCC", stage: "a-contacter" },
  ],
  contactSteps: [
    { contact_id: "ifci", step_id: "c" },
    { contact_id: "irc", step_id: "f" },
  ],
  saved: 1_000_000,
  fundsMin: 6_258_000,
  today: "2026-11-22",
};

describe("procédure Entrée express", () => {
  it("lit le numéro de phase et rattache les étapes de pièces", () => {
    expect(phaseNumber("2. Tests et preuves")).toBe(2);
    expect(phaseNumber("Divers")).toBeNull();
    expect(phaseOfStage("langues")).toBe(2);
    expect(phaseOfStage("installation")).toBe(5);
  });

  it("trouve la phase en cours et ignore les étapes « Si nécessaire »", () => {
    const p = buildProcedure(base);
    expect(p.current).toBe(1);
    expect(p.phases[0]).toMatchObject({ done: 1, total: 2, state: "en-cours" });
    expect(p.phases[1]).toMatchObject({ total: 1, state: "a-venir" });
  });

  it("donne à chaque onglet ce qui reste pour la phase en cours et la suivante", () => {
    const p = buildProcedure(base);
    const of = (t: string) =>
      p.alerts.filter((a) => a.tab === t).map((a) => a.text);
    expect(of("documents")[0]).toMatch(/phase 1.*Passeport/);
    expect(of("documents")[1]).toMatch(/phase 2.*TCF/);
    expect(of("coffre")[0]).toMatch(/sans scan : Extrait/);
    expect(of("budget")[0]).toMatch(/^Phase 1.*75 000 F encore à payer/);
    expect(of("epargne")[0]).toMatch(/encore 5 258 000 F d'ici le 15 mai 2027/);
    // IRCC est lié à la phase 3 : hors des phases 1 et 2.
    expect(of("contacts")[0]).toMatch(/1 organisme.*Institut français$/);
    expect(of("parcours")[0]).toMatch(/Retirer le passeport/);
  });

  it("signale les retards et les dépassements", () => {
    const p = buildProcedure({
      ...base,
      today: "2026-12-10",
      steps: [
        ...base.steps,
        step("x", "1. Mise en ordre", "Fait", "2026-11-13", 10000, 200000),
      ],
    });
    expect(p.alerts.find((a) => a.tab === "parcours")).toMatchObject({
      level: "hi",
    });
    expect(p.alerts.find((a) => a.tab === "budget")?.text).toMatch(
      /dépassement/,
    );
  });
});
