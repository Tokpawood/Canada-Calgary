import { describe, expect, it } from "vitest";
import { IELTS, TCF, addDays, allKeys, dayPlan, levels, overallLevel, programDays, programOf, streak, weekKeys, weekday } from "./formation";

describe("programmes TCF puis IELTS", () => {
  it("13 semaines TCF contiguës du lundi au dimanche", () => {
    expect(TCF.weeks).toHaveLength(13);
    TCF.weeks.forEach((w, i) => {
      expect(weekday(w.from)).toBe(1);
      expect(weekday(w.to)).toBe(7);
      if (i) expect(addDays(TCF.weeks[i - 1].to, 1)).toBe(w.from);
    });
  });

  it("6 semaines IELTS contiguës, du lendemain du TCF à l'examen du 27/03", () => {
    expect(IELTS.weeks).toHaveLength(6);
    expect(IELTS.weeks[0].from).toBe(addDays(TCF.to, 1));
    IELTS.weeks.forEach((w, i) => i && expect(addDays(IELTS.weeks[i - 1].to, 1)).toBe(w.from));
    expect(IELTS.weeks[5].to).toBe("2027-03-27");
    expect(programDays()).toHaveLength(132);
  });

  it("jours TCF : écrit et oral selon le jour, 15 min d'anglais", () => {
    const lundi = dayPlan("2026-11-16")!;
    expect(lundi.program.id).toBe("tcf");
    expect(lundi.items.find((i) => i.key.endsWith(":am"))!.label).toContain("tâche 3");
    expect(lundi.items.find((i) => i.key.endsWith(":en"))!.lang).toBe("ielts");
    expect(dayPlan("2026-11-17")!.items.find((i) => i.key.endsWith(":am"))!.label).toContain("tâches 1 et 2");
    expect(dayPlan("2026-11-19")!.items.find((i) => i.key.endsWith(":pm"))!.label).toContain("tâche 1");
  });

  it("jours IELTS : Task 2 lun/mer/ven, Task 1 mar/jeu, 3 parts du Speaking le vendredi", () => {
    expect(dayPlan("2027-02-17")!.items.find((i) => i.key.endsWith(":am"))!.label).toContain("Task 2");
    expect(dayPlan("2027-02-18")!.items.find((i) => i.key.endsWith(":am"))!.label).toContain("Task 1");
    expect(dayPlan("2027-02-19")!.items.find((i) => i.key.endsWith(":pm"))!.label).toContain("3 parts");
  });

  it("examens blancs : samedis prévus par les deux programmes", () => {
    for (const d of ["2026-12-19", "2027-01-02", "2027-01-16", "2027-01-30", "2027-02-06", "2027-03-06", "2027-03-20"]) {
      expect(dayPlan(d)!.items[0].label).toContain("Examen blanc");
    }
    expect(dayPlan("2026-11-28")!.items[0].label).toContain("compréhension");
  });

  it("jours d'examen et repos", () => {
    expect(dayPlan("2027-02-15")!.kind).toBe("examen");
    expect(dayPlan("2027-03-27")!.kind).toBe("examen");
    expect(dayPlan("2027-02-13")!.kind).toBe("repos");
    expect(programOf("2027-02-16")!.id).toBe("ielts");
    expect(dayPlan("2026-11-15")).toBeNull();
    expect(dayPlan("2027-03-28")).toBeNull();
  });

  it("tâches datées partagées avec les envois", () => {
    expect(dayPlan("2026-12-14")!.items[0].key).toBe("t5:e0");
    expect(dayPlan("2027-01-25")!.items[0].key).toBe("t11:e2");
    expect(dayPlan("2027-03-23")!.items[0].key).toBe("i6:e0");
    const keys = allKeys();
    expect(new Set(keys).size).toBe(keys.length);
    expect(weekKeys(TCF.weeks[4]).filter((k) => k === "t5:e0")).toHaveLength(1);
  });

  it("série de jours complets", () => {
    const done = new Set([...dayPlan("2026-11-16")!.items, ...dayPlan("2026-11-17")!.items].map((i) => i.key));
    expect(streak("2026-11-18", done)).toBe(2);
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
