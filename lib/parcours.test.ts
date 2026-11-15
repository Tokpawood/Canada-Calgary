import { describe, expect, it } from "vitest";
import { foldText, nextStepPosition, parseAmount, sortStepsByDue, stepMatchesQuery } from "./parcours";

const base = { title: "Prendre rendez-vous biométrie", org: "IRCC", notes: "", req: "", risk: "", tasks: [{ text: "Réserver le créneau au CRDV" }] };

describe("foldText", () => {
  it("retire accents et majuscules", () => {
    expect(foldText("Biométrie ÉTÉ")).toBe("biometrie ete");
  });
});

describe("stepMatchesQuery", () => {
  it("ignore accents et casse", () => {
    expect(stepMatchesQuery(base, "BIOMETRIE")).toBe(true);
  });
  it("cherche dans les mini-étapes", () => {
    expect(stepMatchesQuery(base, "crdv")).toBe(true);
  });
  it("exige tous les mots", () => {
    expect(stepMatchesQuery(base, "ircc biometrie")).toBe(true);
    expect(stepMatchesQuery(base, "ircc passeport")).toBe(false);
  });
  it("requête vide : tout correspond", () => {
    expect(stepMatchesQuery(base, "   ")).toBe(true);
  });
});

describe("sortStepsByDue", () => {
  it("trie par date, sans date à la fin, ordre du parcours à égalité", () => {
    const steps = [
      { id: "a", due: null, position: 0 },
      { id: "b", due: "2026-03-01", position: 2 },
      { id: "c", due: "2026-01-01", position: 3 },
      { id: "d", due: "2026-03-01", position: 1 },
      { id: "e", due: null, position: -1 },
    ];
    expect(sortStepsByDue(steps).map((s) => s.id)).toEqual(["c", "d", "b", "e", "a"]);
  });
});

describe("nextStepPosition", () => {
  it("suit la plus grande position", () => {
    expect(nextStepPosition([])).toBe(0);
    expect(nextStepPosition([{ position: 0 }, { position: 7 }, { position: 3 }])).toBe(8);
  });
});

describe("parseAmount", () => {
  it("accepte vide, entiers, espaces et virgule", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("150 000")).toBe(150000);
    expect(parseAmount("12,5")).toBe(12.5);
  });
  it("refuse négatif et invalide", () => {
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});
