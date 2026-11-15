import { describe, expect, it } from "vitest";
import { fmtDelta, parseScores, scoreDeltas } from "./formationScores";

describe("parseScores", () => {
  it("accepte la virgule et les champs vides", () => {
    expect(parseScores("ielts", ["7,5", "", "6", " 7 "])).toEqual({ ok: true, scores: [7.5, null, 6, 7] });
    expect(parseScores("tcf", ["549", "", "16", ""])).toEqual({ ok: true, scores: [549, null, 16, null] });
  });

  it("refuse les bornes dépassées et les formats invalides", () => {
    expect(parseScores("tcf", ["700", "", "", ""]).ok).toBe(false);
    expect(parseScores("tcf", ["", "", "21", ""]).ok).toBe(false);
    expect(parseScores("tcf", ["-3", "", "", ""]).ok).toBe(false);
    expect(parseScores("tcf", ["abc", "", "", ""]).ok).toBe(false);
    expect(parseScores("ielts", ["9.5", "", "", ""]).ok).toBe(false);
  });

  it("impose les demi-bandes IELTS et les notes entières TCF", () => {
    expect(parseScores("ielts", ["6.3", "", "", ""]).ok).toBe(false);
    expect(parseScores("tcf", ["", "", "14,5", ""]).ok).toBe(false);
  });

  it("exige au moins une note", () => {
    expect(parseScores("tcf", ["", "", "", ""])).toEqual({ ok: false, error: "Saisissez au moins une note." });
  });
});

describe("scoreDeltas", () => {
  it("compare avec le dernier test qui notait la compétence", () => {
    const d = scoreDeltas([{ scores: [500, null, 12, 10] }, { scores: [520, 480, null, 10] }, { scores: [510, 500, 14, null] }]);
    expect(d).toEqual([
      [null, null, null, null],
      [20, null, null, 0],
      [-10, 20, 2, null],
    ]);
  });

  it("arrondit les demi-bandes", () => {
    expect(scoreDeltas([{ scores: [6.5, null, null, null] }, { scores: [7, null, null, null] }])[1][0]).toBe(0.5);
  });
});

describe("fmtDelta", () => {
  it("formate en français", () => {
    expect(fmtDelta(12)).toBe("+12");
    expect(fmtDelta(-0.5)).toBe("−0,5");
    expect(fmtDelta(0)).toBe("=");
  });
});
