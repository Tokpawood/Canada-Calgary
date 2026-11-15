import { describe, expect, it } from "vitest";
import { countPeriodIssues, periodIssues } from "./profilPeriods";

const NOW = new Date(2026, 10, 15);

describe("periodIssues", () => {
  it("accepte une période valide, au jour ou au mois", () => {
    expect(periodIssues("2015-09-01", "2018-06-30", NOW)).toEqual({});
    expect(periodIssues("2015-09", "2018-06", NOW)).toEqual({});
    expect(periodIssues("2020-01-15", "", NOW)).toEqual({});
  });

  it("exige une date de début", () => {
    expect(periodIssues("", "", NOW).from).toMatch(/obligatoire/);
  });

  it("signale un format illisible", () => {
    expect(periodIssues("01/09/2015", "", NOW).from).toMatch(/Format/);
    expect(periodIssues("2015-09-01", "juin 2018", NOW).to).toMatch(/Format/);
  });

  it("signale une date impossible", () => {
    expect(periodIssues("2015-13-01", "", NOW).from).toMatch(/impossible/);
    expect(periodIssues("2015-01-01", "2019-02-30", NOW).to).toMatch(/impossible/);
  });

  it("signale une fin antérieure au début", () => {
    expect(periodIssues("2018-06-01", "2017-01-01", NOW).to).toMatch(/précède/);
    // Même mois, fin au mois : couvre tout le mois, donc pas d'erreur.
    expect(periodIssues("2018-06-20", "2018-06", NOW)).toEqual({});
  });

  it("signale un début dans le futur", () => {
    expect(periodIssues("2027-01-01", "", NOW).from).toMatch(/futur/);
    expect(periodIssues("2026-11-15", "", NOW)).toEqual({});
  });
});

describe("countPeriodIssues", () => {
  it("compte les lignes en erreur", () => {
    expect(
      countPeriodIssues(
        [
          { from: "2015-09", to: "2016-01" },
          { from: "", to: "" },
          { from: "2016-02", to: "2015-01" },
        ],
        NOW,
      ),
    ).toBe(2);
  });
});
