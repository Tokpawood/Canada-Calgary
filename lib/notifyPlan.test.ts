import { describe, expect, it } from "vitest";
import { dayPlan } from "./formation";
import { DEFAULT_SETTINGS, abidjanNow, cleanTimes, dueNow, remindersFor } from "./notifyPlan";

const MON = "2026-11-16";
const SAT = "2026-11-21";

describe("rappels de la formation", () => {
  it("un jour de semaine : résumé, chaque moment, puis bilan, dans l'ordre", () => {
    const r = remindersFor(MON, new Set(), DEFAULT_SETTINGS);
    expect(r.map((x) => x.key.split(":")[1])).toEqual(["resume", "matin", "aller", "midi", "retour", "soir", "carnet", "bilan"]);
    expect(r.map((x) => x.at)).toEqual(["05:00", "05:15", "06:00", "12:30", "17:30", "20:30", "21:15", "21:45"]);
    expect(r[1].url).toBe(`/formation?d=${MON}&t=${encodeURIComponent(`${MON}:am`)}#jour`);
  });

  it("un moment dont toutes les tâches sont faites n'est pas rappelé", () => {
    const keys = dayPlan(MON)!.items.map((i) => i.key);
    const aller = new Set(keys.filter((k) => /:t[123]$/.test(k)));
    const r = remindersFor(MON, aller, DEFAULT_SETTINGS);
    expect(r.some((x) => x.key.endsWith(":aller"))).toBe(false);
    const all = remindersFor(MON, new Set(keys), DEFAULT_SETTINGS);
    expect(all).toEqual([]);
  });

  it("le samedi suit les horaires du programme", () => {
    const r = remindersFor(SAT, new Set(), DEFAULT_SETTINGS);
    expect(r.map((x) => x.at)).toContain("08:00");
    expect(r.map((x) => x.at)).toContain("15:00");
  });

  it("horaires réglables, valeurs invalides ignorées", () => {
    const times = cleanTimes({ matin: "06:10", soir: "25:00", autre: "07:00" });
    expect(times).toEqual({ matin: "06:10" });
    const r = remindersFor(MON, new Set(), { ...DEFAULT_SETTINGS, times });
    expect(r.find((x) => x.key.endsWith(":matin"))!.at).toBe("06:10");
  });

  it("étapes du parcours dans le résumé, désactivables", () => {
    const steps = [
      { title: "Biométrie", due: MON, open: true },
      { title: "EDE", due: "2026-11-01", open: true },
      { title: "Passeport", due: "2026-10-01", open: false },
    ];
    const on = remindersFor(MON, new Set(), DEFAULT_SETTINGS, steps)[0];
    expect(on.body).toContain("Biométrie");
    expect(on.body).toContain("1 étape en retard");
    const off = remindersFor(MON, new Set(), { ...DEFAULT_SETTINGS, includeSteps: false }, steps)[0];
    expect(off.body).not.toContain("Biométrie");
    // Hors programme, seul le parcours déclenche un résumé.
    expect(remindersFor("2026-11-10", new Set(), DEFAULT_SETTINGS, steps).map((x) => x.key)).toEqual(["2026-11-10:resume"]);
    expect(remindersFor("2026-11-10", new Set(), DEFAULT_SETTINGS)).toEqual([]);
  });

  it("fenêtre d'envoi de 30 minutes et désactivation", () => {
    const r = remindersFor(MON, new Set(), DEFAULT_SETTINGS);
    expect(dueNow(r, "05:20").map((x) => x.at)).toEqual(["05:00", "05:15"]);
    expect(dueNow(r, "05:40").map((x) => x.at)).toEqual(["05:15"]);
    expect(dueNow(r, "04:59")).toEqual([]);
    expect(remindersFor(MON, new Set(), { ...DEFAULT_SETTINGS, enabled: false })).toEqual([]);
  });

  it("heure d'Abidjan = UTC", () => {
    expect(abidjanNow(new Date("2026-11-16T23:50:00Z"))).toEqual({ date: "2026-11-16", time: "23:50" });
    // Minuit : « 00:05 » et non « 24:05 » (certains moteurs avec hour12: false).
    expect(abidjanNow(new Date("2026-11-17T00:05:00Z"))).toEqual({ date: "2026-11-17", time: "00:05" });
  });
});

describe("rappel du matin : pièces qui expirent", () => {
  it("rappelle une pièce à J-30, J-7, J-1 et le jour même seulement", async () => {
    const { remindersFor, DEFAULT_SETTINGS } = await import("./notifyPlan");
    const docs = [{ name: "Passeport", expires: "2026-12-15" }, { name: "Police", expires: "2026-11-20" }];
    const resume = (date: string) => remindersFor(date, new Set(), DEFAULT_SETTINGS, [], docs).find((r) => r.key.endsWith(":resume"));
    expect(resume("2026-11-15")?.body).toContain("Pièce « Passeport » : expire dans 30 jours");
    expect(resume("2026-11-15")?.body ?? "").not.toContain("Police");
    expect(resume("2026-11-13")?.body).toContain("Pièce « Police » : expire dans 7 jours");
    expect(resume("2026-11-20")?.body).toContain("Pièce « Police » : expire aujourd'hui");
    expect(remindersFor("2026-11-15", new Set(), { ...DEFAULT_SETTINGS, includeSteps: false }, [], docs).some((r) => (r.body ?? "").includes("Passeport"))).toBe(false);
  });
});
