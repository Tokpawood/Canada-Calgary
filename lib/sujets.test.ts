import { describe, expect, it } from "vitest";
import { dayPlan, programDays } from "./formation";
import { CONSIGNES, KINDS, METHODES, exercicesFor, intitule, joursSansExercice, sujetsOf } from "./sujets";

const item = (d: string, topic: string) => dayPlan(d)!.items.find((i) => i.topic === topic)!;

describe("sujets du jour", () => {
  it("couvre chaque tâche d'expression et de grammaire du TCF dès la semaine 2", () => {
    const days = programDays().filter((d) => d >= "2026-11-23" && d <= "2027-02-12");
    expect(joursSansExercice(days)).toEqual([]);
  });

  it("donne un seul sujet par tâche, et laisse la place au sujet du test", () => {
    expect(exercicesFor("2026-11-24", item("2026-11-24", "tcf-ee12")).map((e) => e.kind)).toEqual(["ee1", "ee2"]);
    expect(exercicesFor("2026-11-23", item("2026-11-23", "tcf-ee3")).length).toBe(1);
    expect(exercicesFor("2026-11-25", item("2026-11-25", "tcf-ee3"))).toEqual([]); // test d'expression écrite
    const eo = ["2026-11-23", "2026-11-25", "2026-11-27"].map((d) => intitule(exercicesFor(d, item(d, "tcf-eo3"))[0]));
    expect(new Set(eo).size).toBe(3);
  });

  it("range tous les sujets dans la banque, avec consigne et méthodologie", () => {
    expect(sujetsOf("ee3").flatMap((g) => g.items).length).toBe(36);
    for (const { kind } of KINDS) {
      expect(CONSIGNES[kind].length).toBeGreaterThan(0);
      expect(METHODES[kind].etapes.length).toBeGreaterThan(1);
    }
  });

  it("a des documents de longueur TCF et aucun sujet en double", () => {
    const t3 = sujetsOf("ee3").flatMap((g) => g.items).flatMap((e) => (e.kind === "ee3" ? [e.sujet] : []));
    expect(new Set(t3.map((x) => x.titre)).size).toBe(t3.length);
    const n = t3.flatMap((x) => [x.a, x.b]).map((d) => d.split(/ +/).length);
    expect(Math.min(...n)).toBeGreaterThanOrEqual(60);
    expect(Math.max(...n)).toBeLessThanOrEqual(120);
  });
});
