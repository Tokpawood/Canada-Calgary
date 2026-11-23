import { describe, expect, it } from "vitest";
import { dayPlan } from "./formation";
import {
  LEVELS,
  kindFor,
  tcfDigest,
  adaptiveLevels,
  currentEstimates,
  estimateScore,
  finalizeQuestions,
  gradeComprehension,
  levelFromNote,
  levelFromScore,
  mapTcfRow,
  nclcOf,
  paceMinutes,
  planFor,
  withParts,
  type CeItem,
  type Level,
  type TcfRow,
} from "./tcf";

const all = (correct: (l: Level, i: number) => boolean) => LEVELS.flatMap((l) => [0, 1, 2, 3].map((i) => ({ level: l, correct: correct(l, i) })));

describe("barèmes TCF", () => {
  it("convertit scores et notes en niveaux et NCLC", () => {
    expect(levelFromScore(452)).toBe("B2");
    expect(levelFromScore(699)).toBe("C2");
    expect(levelFromScore(120)).toBe("A1");
    expect(levelFromNote(16)).toBe("C2");
    expect(levelFromNote(13)).toBe("B2");
    expect(nclcOf("co", 549)).toBe(10);
    expect(nclcOf("ce", 498)).toBe(7);
    expect(nclcOf("ee", 14)).toBe(9);
    expect(nclcOf("eo", 3)).toBe(3);
  });

  it("estime un score cohérent avec les réponses", () => {
    expect(estimateScore(all(() => true))).toBeGreaterThan(640);
    expect(estimateScore(all(() => false))).toBeLessThan(160);
    const b2 = estimateScore(all((l) => LEVELS.indexOf(l) <= 3));
    expect(levelFromScore(b2)).toMatch(/B2|C1/);
    const b1 = estimateScore(all((l, i) => LEVELS.indexOf(l) <= 1 || (l === "B1" && i < 3)));
    expect(levelFromScore(b1)).toMatch(/A2|B1/);
  });
});

describe("plan des tests", () => {
  it("vise autour du niveau actuel en tirant vers C2", () => {
    const lv = adaptiveLevels(20, 452);
    expect(lv).toHaveLength(20);
    expect(lv[0]).toBe("B1");
    expect(lv.at(-1)).toBe("C2");
    expect(adaptiveLevels(10, 680).every((l) => l === "C1" || l === "C2")).toBe(true);
  });

  it("suit la rotation de la semaine et découpe en morceaux", () => {
    expect(planFor("quotidien", "2026-11-23", {})!.sections.map((s) => s.epreuve)).toEqual(["co"]); // lundi
    expect(planFor("quotidien", "2026-11-26", {})!.sections.map((s) => s.epreuve)).toEqual(["eo", "co"]); // jeudi
    const blanc = withParts(planFor("blanc", "2026-11-28", {})!.sections);
    expect(blanc.sections[0].levels).toHaveLength(39);
    expect(blanc.sections[0].parts).toHaveLength(8);
    expect(blanc.sections.flatMap((s) => s.parts.map((p) => p.idx))).toEqual([...Array(18).keys()]);
    expect(planFor("positionnement", "2026-11-23", {})!.sections.map((s) => s.epreuve)).toEqual(["co", "ce", "ee"]);
    expect(planFor("quotidien", "2026-11-22", { co: 400, ce: 500 })!.title).toContain("orale"); // dimanche : point faible
  });

  it("suit le programme de formation : examen blanc chaque samedi, repos final", () => {
    expect(kindFor("2026-11-28", true)).toBe("blanc"); // examen blanc n° 1
    expect(kindFor("2026-12-19", true)).toBe("blanc"); // examen blanc n° 4
    expect(kindFor("2026-12-19", false)).toBe("positionnement");
    const sat = planFor("quotidien", "2026-11-28", { co: 500, ce: 420 })!;
    expect(sat.sections.map((s) => s.epreuve)).toEqual(["ce", "ee"]);
    expect(sat.sections[0].levels).toHaveLength(39);
    expect(planFor("blanc", "2026-12-19", {})!.title).toBe("TCF Canada blanc n° 4 complet");
    expect(planFor("quotidien", "2027-02-13", {})).toBeNull();
    expect(planFor("quotidien", "2026-12-21", {})!.sections[0].levels).toHaveLength(10); // semaine allégée
  });
});

describe("correction", () => {
  const raw = { level: "B2" as Level, type: "article", context: "", title: "T", text: "…", question: "Q ?", options: ["A) un", "B) deux", "C) trois", "D) quatre"], answer: "C" as const, explanation: "Parce que.", focus: "détail" };
  const items = finalizeQuestions([raw, { ...raw, answer: "A" as const }], "ce", 0, ["B1", "B2"]) as CeItem[];

  it("numérote les questions et nettoie les propositions", () => {
    expect(items.map((i) => i.id)).toEqual(["ce-1", "ce-2"]);
    expect(items[0].options[0]).toBe("un");
    expect(items[0].level).toBe("B1");
  });

  it("cache les réponses tant que la section n'est pas rendue", () => {
    const plan = withParts([{ epreuve: "ce", minutes: 3, levels: ["B1", "B2"] }]);
    const row: TcfRow = { id: "t", day: "2026-11-23", kind: "quotidien", title: "", plan, sources: [], progress: {}, summary: null, status: "pret" };
    const part = { test_id: "t", idx: 0, status: "pret" as const, content: { items }, error: null };
    const hidden = mapTcfRow(row, [part]).parts[0].content as { items: CeItem[] };
    expect(hidden.items[0].explanation).toBe("");
    const shown = mapTcfRow({ ...row, progress: { "0": { submitted_at: "2026-11-23T10:00:00Z" } } }, [part]).parts[0].content as { items: CeItem[] };
    expect(shown.items[0].answer).toBe("C");
  });

  it("note une section et met à jour le niveau courant", () => {
    const r = gradeComprehension("ce", items, { "ce-1": "C", "ce-2": "B" }, 400);
    expect(r.questions?.map((q) => q.correct)).toEqual([true, false]);
    expect(r.value).toBeGreaterThan(300);
    const plan = withParts([{ epreuve: "ce", minutes: 3, levels: ["B1", "B2"] }]);
    const est = currentEstimates([
      { day: "2026-11-20", plan, progress: { "0": { result: { ...r, value: 400 } } } },
      { day: "2026-11-21", plan, progress: { "0": { result: { ...r, value: 500 } } } },
    ]);
    expect(est.ce).toBe(463);
  });
});

describe("liens avec la formation", () => {
  it("le plan du jour envoie vers le test et les exercices", () => {
    const mon = dayPlan("2026-11-23")!;
    const co = mon.items.find((i) => i.key.endsWith(":t1"))!;
    expect(co.tool).toBe("tcf");
    expect(co.epreuve).toBe("co");
    expect(mon.items.find((i) => i.key.endsWith(":fin"))!.tool).toBe("exercices");
    expect(dayPlan("2026-11-29")!.items.some((i) => i.tool === "tcf")).toBe(true); // dimanche
    expect(dayPlan("2027-02-13")!.items.some((i) => i.tool)).toBe(false);
  });

  it("résume les tests pour les exercices du jour", () => {
    expect(tcfDigest([])).toBe("");
    const t = {
      id: "t", day: "2026-11-23", kind: "quotidien" as const, title: "", sources: [], summary: null, status: "corrige" as const, parts: {},
      plan: { sections: [{ epreuve: "co" as const, minutes: 10, levels: ["B2" as Level], parts: [] }] },
      progress: { "0": { result: { epreuve: "co" as const, value: 480, level: "B2" as Level, nclc: 7, questions: [{ id: "co-1", level: "B2" as Level, chosen: "A", correct: false }] } } },
    };
    const d = tcfDigest([t]);
    expect(d).toContain("Compréhension orale : 480/699");
    expect(d).toContain("objectif examen 549/699");
    expect(d).toContain("CO B2");
  });
});

describe("durée des épreuves de compréhension", () => {
  const spread = [4, 6, 9, 9, 6, 5].flatMap((n, i) => Array<Level>(n).fill((["A1", "A2", "B1", "B2", "C1", "C2"] as Level[])[i]));
  it("garde la durée officielle pour la répartition officielle", () => {
    expect(paceMinutes("co", spread)).toBe(35);
    expect(paceMinutes("ce", spread)).toBe(60);
  });
  it("donne plus de temps à un test C1-C2", () => {
    const hard = [...Array<Level>(4).fill("B2"), ...Array<Level>(9).fill("C1"), ...Array<Level>(7).fill("C2")];
    expect(paceMinutes("co", hard)).toBeGreaterThanOrEqual(23);
    expect(paceMinutes("ce", hard)).toBeGreaterThanOrEqual(40);
  });
});
