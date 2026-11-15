import { describe, expect, it } from "vitest";
import { WEEKS, addDays, allKeys, dayPlan, levels, overallLevel, programDays, slotLang, streak, weekKeys, weekday } from "./formation";

describe("calendrier du programme", () => {
  it("13 semaines contiguës du lundi au dimanche", () => {
    expect(WEEKS).toHaveLength(13);
    WEEKS.forEach((w, i) => {
      expect(weekday(w.from)).toBe(1);
      expect(weekday(w.to)).toBe(7);
      expect(addDays(w.from, 6)).toBe(w.to);
      if (i) expect(addDays(WEEKS[i - 1].to, 1)).toBe(w.from);
    });
    expect(programDays()).toHaveLength(92);
  });

  it("lundi, mercredi, vendredi en TCF ; mardi, jeudi en IELTS", () => {
    expect(dayPlan("2026-11-16")!.lang).toBe("tcf");
    expect(dayPlan("2026-11-17")!.lang).toBe("ielts");
    expect(dayPlan("2026-11-18")!.lang).toBe("tcf");
    expect(dayPlan("2026-11-19")!.lang).toBe("ielts");
    expect(dayPlan("2026-11-16")!.items).toHaveLength(8);
  });

  it("sprint IELTS : production en anglais, trajets en TCF", () => {
    expect(slotLang("2027-01-21", false)).toBe("ielts"); // mercredi
    expect(slotLang("2027-01-21", true)).toBe("tcf");
    const p = dayPlan("2027-01-19")!;
    expect(p.items.find((i) => i.key.endsWith(":am"))!.lang).toBe("ielts");
    expect(p.items.find((i) => i.key.endsWith(":t1"))!.lang).toBe("tcf");
  });

  it("tout repasse au TCF à partir du 31 janvier", () => {
    expect(slotLang("2027-02-02", false)).toBe("tcf"); // mardi
    expect(dayPlan("2027-02-04")!.lang).toBe("tcf"); // jeudi
  });

  it("jours d'examen", () => {
    expect(dayPlan("2027-01-30")!.kind).toBe("examen");
    expect(dayPlan("2027-02-15")!.items[0].label).toContain("TCF Canada");
    expect(dayPlan("2026-11-15")).toBeNull();
    expect(dayPlan("2027-02-16")).toBeNull();
  });

  it("samedis : examen blanc et correction ; veille du TCF en repos actif", () => {
    expect(dayPlan("2026-11-21")!.items.map((i) => i.key)).toEqual(["2026-11-21:blanc", "2026-11-21:correction"]);
    expect(dayPlan("2027-02-13")!.items).toHaveLength(1);
  });

  it("tâches datées partagées avec les envois (pack Gold, inscription)", () => {
    expect(dayPlan("2026-12-14")!.items[0].key).toBe("s5:e0");
    expect(dayPlan("2027-01-05")!.items[0].key).toBe("s8:e0");
    const keys = allKeys();
    expect(new Set(keys).size).toBe(keys.length);
    expect(weekKeys(WEEKS[4]).filter((k) => k === "s5:e0")).toHaveLength(1);
  });

  it("série de jours complets", () => {
    const done = new Set([...dayPlan("2026-11-16")!.items, ...dayPlan("2026-11-17")!.items].map((i) => i.key));
    expect(streak("2026-11-18", done)).toBe(2);
    expect(streak("2026-11-17", done)).toBe(2);
    expect(streak("2026-11-20", done)).toBe(0);
  });
});

describe("niveaux NCLC et CLB", () => {
  it("TCF : 549 et 16/20 donnent NCLC 10", () => {
    expect(levels("tcf", [549, 548, 16, 15])).toEqual([10, 9, 10, 9]);
    expect(overallLevel("tcf", [600, 600, 18, 15])).toEqual({ level: 9, weakest: [3] });
  });
  it("IELTS : CLB 9 avec 8 / 7 / 7 / 7", () => {
    expect(levels("ielts", [8, 7, 7, 7])).toEqual([9, 9, 9, 9]);
    expect(levels("ielts", [7.5, 6.5, 6.5, 6])).toEqual([8, 8, 8, 7]);
  });
  it("niveau global inconnu si une note manque", () => {
    expect(overallLevel("tcf", [600, null, 16, 16]).level).toBeNull();
  });
});
