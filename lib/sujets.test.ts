import { describe, expect, it } from "vitest";
import { dayPlan, programDays } from "./formation";
import { SUJETS, autresSujets, exercicesFor, intitule, joursSansExercice } from "./sujets";

const item = (d: string, topic: string) => dayPlan(d)!.items.find((i) => i.topic === topic)!;

describe("sujets du jour", () => {
  it("couvre chaque tâche d'expression et de grammaire du TCF dès la semaine 2", () => {
    const days = programDays().filter((d) => d >= "2026-11-23" && d <= "2027-02-12");
    expect(joursSansExercice(days)).toEqual([]);
  });

  it("donne les tâches 1 et 2 le mardi, la tâche 3 les autres jours, un sujet différent à chaque fois", () => {
    expect(exercicesFor("2026-11-24", item("2026-11-24", "tcf-ee12")).map((e) => e.kind)).toEqual(["ee1", "ee2"]);
    const t3 = ["2026-11-23", "2026-11-25", "2026-11-27"].map((d) => intitule(exercicesFor(d, item(d, "tcf-ee3"))[0]));
    expect(new Set(t3).size).toBe(3);
    expect(exercicesFor("2026-11-26", item("2026-11-26", "tcf-grammaire"))[0].kind).toBe("gram");
  });

  it("propose d'autres sujets sans répéter celui du jour", () => {
    const it3 = item("2026-11-23", "tcf-ee3");
    const others = autresSujets("2026-11-23", it3).map(intitule);
    expect(others.length).toBe(35);
    expect(others).not.toContain(intitule(exercicesFor("2026-11-23", it3)[0]));
  });

  it("n'a aucun sujet en double et des documents de longueur suffisante", () => {
    const t3 = Object.values(SUJETS).flatMap((s) => s.t3);
    expect(new Set(t3.map((x) => x.titre)).size).toBe(t3.length);
    for (const x of t3) for (const d of [x.a, x.b]) expect(d.split(/\s+/).length).toBeGreaterThanOrEqual(30);
  });
});
