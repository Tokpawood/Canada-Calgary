import { describe, expect, it } from "vitest";
import { addBusinessDays, easterSunday, isBusinessDay } from "./businessDays";

describe("jours ouvrables", () => {
  it("calcule Pâques", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("exclut week-ends et fériés", () => {
    expect(isBusinessDay("2026-11-21")).toBe(false); // samedi
    expect(isBusinessDay("2026-11-15")).toBe(false); // dimanche, Journée de la paix
    expect(isBusinessDay("2026-12-25")).toBe(false);
    expect(isBusinessDay("2026-04-06")).toBe(false); // lundi de Pâques
    expect(isBusinessDay("2026-11-20")).toBe(true);
  });

  it("10 jours ouvrables à compter du 19 novembre 2026 : 3 décembre", () => {
    expect(addBusinessDays("2026-11-19", 10)).toBe("2026-12-03");
  });

  it("saute un férié en semaine et un week-end", () => {
    // vendredi 24 déc. 2027 + 1 : lundi 27 (le 25 est un samedi)
    expect(addBusinessDays("2027-12-24", 1)).toBe("2027-12-27");
    // jeudi 31 déc. 2026 + 1 : le 1er janvier est férié → lundi 4 janvier 2027
    expect(addBusinessDays("2026-12-31", 1)).toBe("2027-01-04");
  });

  it("0 jour : date de départ", () => {
    expect(addBusinessDays("2026-11-19", 0)).toBe("2026-11-19");
  });
});
