import { describe, expect, it } from "vitest";
import { buildEvents, diffEvents, googleBody, type CalEvent } from "./calendarPlan";

const input = {
  today: "2026-11-23",
  done: new Set(["2026-11-23:am"]),
  steps: [
    { id: "a", title: "Retirer le passeport", due: "2026-12-03", status: "En cours", tasks: [{ text: "Prendre le reçu", done: true }] },
    { id: "b", title: "Optionnel", due: "2027-03-31", status: "Si nécessaire", tasks: [] },
    { id: "c", title: "Sans date", due: null, status: "À faire", tasks: [] },
  ],
  docs: [{ id: "p", name: "Passeport", expires: "2031-11-16" }],
  base: "https://x.test",
};
const events = buildEvents(input);
const of = (k: string) => events.find((e) => e.key === k);

describe("calendrier", () => {
  it("donne une clé unique à chaque événement", () => {
    expect(new Set(events.map((e) => e.key)).size).toBe(events.length);
    expect(events.length).toBeGreaterThan(900);
  });

  it("place les créneaux, et enchaîne les tâches d'un même trajet", () => {
    expect(of("f:2026-11-23:am")).toMatchObject({ start: 315, minutes: 45 });
    expect(of("f:2026-11-23:am")!.title.startsWith("✓ ")).toBe(true);
    expect(of("f:2026-11-23:t1")!.start).toBe(360);
    expect(of("f:2026-11-23:t2")!.start).toBe(390);
    expect(of("f:2026-11-23:t3")!.start).toBe(450);
    expect(of("f:2026-11-28:matin")!.title).toContain("Examen blanc n° 1");
  });

  it("ajoute les étapes datées et les expirations, sans les étapes facultatives", () => {
    expect(of("s:a")!.description).toContain("☑ Prendre le reçu");
    expect(of("s:b")).toBeUndefined();
    expect(of("s:c")).toBeUndefined();
    expect(of("d:p")!.date).toBe("2031-11-16");
  });

  it("produit des dates valides pour Google", () => {
    expect(googleBody(of("s:a")!)).toMatchObject({ start: { date: "2026-12-03" }, end: { date: "2026-12-04" } });
    expect(googleBody(of("f:2026-11-23:am")!).start).toEqual({ dateTime: "2026-11-23T05:15:00", timeZone: "Africa/Abidjan" });
    const late: CalEvent = { key: "k", date: "2026-11-30", start: 1430, minutes: 30, title: "t", description: "" };
    expect(googleBody(late).end).toMatchObject({ dateTime: "2026-12-01T00:20:00" });
  });

  it("n'envoie que les changements et garde la trace du passé", () => {
    const hash = (e: CalEvent) => e.title;
    const sent = Object.fromEntries(events.map((e) => [e.key, `${e.date}|${hash(e)}`]));
    expect(diffEvents(events, sent, input.today, hash)).toEqual({ save: [], remove: [], forget: [] });
    const d = diffEvents(events, { ...sent, "s:a": "2026-12-03|ancien", "s:z": "2026-12-20|x", "s:y": "2026-10-01|x" }, input.today, hash);
    expect(d.save.map((e) => e.key)).toEqual(["s:a"]);
    expect(d.remove).toEqual(["s:z"]);
    expect(d.forget).toEqual(["s:y"]);
  });
});
