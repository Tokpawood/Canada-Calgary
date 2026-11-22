import { describe, expect, it } from "vitest";
import { QuizSchema, buildGradeContext, buildQuizContext, finalizeItems, gradeClosed, mapQuizRow, normalizeAnswer, progressOf, type QuizItem } from "./quiz";
import type { ErrorEntry, MemoEntry } from "./formation";

const item = (over: Partial<QuizItem>): QuizItem => ({
  id: "e1",
  kind: "trou",
  skill: "Grammaire",
  source: "carnet",
  error_id: "",
  topic: "chez + enseigne",
  instruction: "Complétez.",
  prompt: "Il travaille ___ Orange.",
  options: [],
  accepted: ["chez"],
  explanation: "Nom d'entreprise → chez.",
  ...over,
});

describe("exercices du jour", () => {
  it("corrige les réponses fermées en gardant les accents", () => {
    expect(gradeClosed(item({}), " Chez ").score).toBe(1);
    expect(gradeClosed(item({ accepted: ["à"] }), "a").score).toBe(0);
    expect(gradeClosed(item({ accepted: ["à / chez"] }), "à/chez").score).toBe(1);
    expect(gradeClosed(item({ accepted: ["l'épicerie"] }), "l’épicerie.").score).toBe(1);
    expect(gradeClosed(item({}), "").feedback).toBe("Pas de réponse.");
    expect(normalizeAnswer("« En ce qui concerne »")).toBe("en ce qui concerne");
  });

  it("met en forme le contexte avec le carnet, l'aide-mémoire, le cours et l'historique", () => {
    const errors: ErrorEntry[] = [
      { id: "err-1", exam: "tcf", skill: "Grammaire", wrong: "à Esso", correct: "chez Esso", rule: "chez + marque", count: 2, mastered: false, createdAt: "2026-11-22" },
      { id: "err-2", exam: "ielts", skill: "Writing", wrong: "x", correct: "y", rule: "", count: 1, mastered: false, createdAt: "2026-11-22" },
    ];
    const memos: MemoEntry[] = [{ id: "m1", exam: "tcf", title: "Prépositions", body: "## 1. Chez\ntexte", createdAt: "2026-11-22" }];
    const ctx = buildQuizContext({
      today: "2026-11-23",
      errors,
      memos,
      history: [{ day: "2026-11-22", score: 7, total: 10, items: [{ id: "e1", topic: "chez", skill: "Grammaire", error_id: "err-1", prompt: "Il travaille ___ Orange." }], results: [{ id: "e1", score: 0, feedback: "", corrected: "" }] }],
    });
    expect(ctx).toContain("[err-1]");
    expect(ctx).not.toContain("err-2");
    expect(ctx).toContain("### Prépositions");
    expect(ctx).toContain("Semaine 2");
    expect(ctx).toContain("chez [err-1] ✗ raté");
  });

  it("numérote les exercices et vide les options hors QCM", () => {
    const parsed = QuizSchema.parse({
      title: "t",
      focus: "f",
      items: [
        { kind: "trou", skill: "Grammaire", source: "cours", error_id: "", topic: "a", instruction: "i", prompt: "p", options: ["x"], accepted: ["chez", " "], explanation: "e" },
        { kind: "qcm", skill: "Vocabulaire", source: "aide-memoire", error_id: "", topic: "b", instruction: "i", prompt: "p", options: ["a", "b", "c"], accepted: ["b"], explanation: "e" },
      ],
    });
    const items = finalizeItems(parsed.items);
    expect(items.map((i) => i.id)).toEqual(["e1", "e2"]);
    expect(items[0].options).toEqual([]);
    expect(items[0].accepted).toEqual(["chez"]);
    expect(buildGradeContext(items, { e1: "chez" })).toContain("Réponse du candidat : chez");
  });

  it("cache les réponses attendues tant que la série n'est pas corrigée", () => {
    const row = { id: "q", day: "2026-11-23", title: "t", focus: "f", items: [item({})], answers: null, results: null, score: null, total: 1, status: "pret" as const };
    expect(mapQuizRow(row).items[0]).not.toHaveProperty("accepted");
    expect(mapQuizRow({ ...row, status: "corrige", score: "1", results: { items: [{ id: "e1", score: 1, feedback: "", corrected: "" }], summary: "ok" } }).items[0].accepted).toEqual(["chez"]);
  });

  it("calcule les progrès sur deux semaines", () => {
    const q = (day: string, score: number) => ({ day, score, total: 10, items: [item({})], results: [{ id: "e1", score: score >= 5 ? 1 : 0, feedback: "", corrected: "" }] });
    const p = progressOf([q("2026-11-23", 8), q("2026-11-20", 6), q("2026-11-12", 4)], "2026-11-23");
    expect(p.done).toBe(3);
    expect(p.last7).toBe(70);
    expect(p.prev7).toBe(40);
    expect(p.byTopic[0]).toMatchObject({ topic: "chez + enseigne", n: 3 });
  });
});
