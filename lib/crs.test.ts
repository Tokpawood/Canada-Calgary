import { describe, expect, it } from "vitest";
import { crsAgePoints, crsCalc, crsScenarios } from "./crs";

const base = {
  age: 26,
  edu: "p3",
  fr: [10, 10, 10, 10] as [number, number, number, number],
  en: [0, 0, 0, 0] as [number, number, number, number],
  foreignYears: 3,
};

describe("score CRS (candidat seul)", () => {
  it("barème de l'âge", () => {
    expect(crsAgePoints(26)).toBe(110);
    expect(crsAgePoints(30)).toBe(105);
    expect(crsAgePoints(44)).toBe(6);
    expect(crsAgePoints(45)).toBe(0);
  });

  it("français NCLC 10 sans anglais : facteurs de base, transférabilité et bonus de 25", () => {
    const r = crsCalc(base);
    expect(r).toMatchObject({
      first: "fr",
      age: 110,
      edu: 120,
      lang1: 136,
      lang2: 0,
      transferEdu: 25,
      transferWork: 50,
      transfer: 75,
      french: 25,
    });
    expect(r.total).toBe(110 + 120 + 136 + 75 + 25);
  });

  it("anglais NCLC 5 : 4 points de 2e langue et bonus français porté à 50", () => {
    const r = crsCalc({ ...base, en: [5, 5, 5, 5] });
    expect(r.lang2).toBe(4);
    expect(r.french).toBe(50);
  });

  it("sous NCLC 7 : ni transférabilité ni bonus français", () => {
    const r = crsCalc({ ...base, fr: [9, 9, 6, 9] });
    expect(r.transfer).toBe(0);
    expect(r.french).toBe(0);
  });

  it("scénarios croisés", () => {
    const s = crsScenarios(base);
    expect(s.map((r) => r.fr)).toEqual([7, 9, 10]);
    expect(s[2].cells[1].total).toBeGreaterThan(s[2].cells[0].total);
  });
});
