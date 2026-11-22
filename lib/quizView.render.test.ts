import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QuizView } from "../components/formation/QuizView";
import type { Quiz } from "./quiz";

const items: Quiz["items"] = [
  { id: "e1", kind: "trou", skill: "Grammaire", source: "carnet", error_id: "", topic: "chez", instruction: "Complétez.", prompt: "Il travaille ___ Orange et ___ Esso.", options: [] },
  { id: "e2", kind: "qcm", skill: "Grammaire", source: "cours", error_id: "", topic: "subjonctif", instruction: "Choisissez.", prompt: "Il faut que nous ___.", options: ["finissons", "finissions"] },
  { id: "e3", kind: "correction", skill: "Expression écrite", source: "aide-memoire", error_id: "", topic: "public", instruction: "Corrigez.", prompt: "Les lieux publiques.", options: [] },
];
const base: Quiz = { id: "q1", day: "2026-11-22", title: "Série 1", focus: "Focus", items, answers: null, results: null, summary: "", score: null, total: 3, status: "pret" };
const done: Quiz = {
  ...base,
  id: "q0",
  day: "2026-11-21",
  status: "corrige",
  score: 1.5,
  summary: "Bien.",
  answers: { e1: "chez / chez", e2: "finissons", e3: "Les lieux publiques." },
  items: items.map((it) => ({ ...it, accepted: ["chez / chez"], explanation: "Règle." })),
  results: [
    { id: "e1", score: 1, feedback: "", corrected: "" },
    { id: "e2", score: 0, feedback: "Subjonctif.", corrected: "finissions" },
    { id: "e3", score: 0.5, feedback: "Accord.", corrected: "Les lieux publics." },
  ],
};
const render = (quizzes: Quiz[]) => renderToString(createElement(QuizView, { quizzes, setQuizzes: () => {}, setErrors: () => {}, today: "2026-11-22", canEdit: true }));

describe("écran des exercices", () => {
  it("affiche l'accueil, la série en cours et la correction", () => {
    expect(render([])).toContain("Préparer la série du jour");
    const doing = render([base, done]);
    expect(doing).toContain("Blanc 2 sur 2");
    expect(doing).toContain("Séries précédentes");
    expect(doing).toContain("Vos progrès");
    const corrected = render([{ ...done, day: "2026-11-22" }]);
    expect(corrected).toContain("Correction détaillée");
    expect(corrected).toContain("line-through");
    expect(corrected).toContain("À revoir (2)");
  });
});
