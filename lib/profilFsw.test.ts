import { describe, expect, it } from "vitest";
import { nclcIssue } from "./profilFsw";

const empty = { fr_co: "", fr_ce: "", fr_eo: "", fr_ee: "", en_co: "", en_ce: "", en_eo: "", en_ee: "" };

describe("nclcIssue", () => {
  it("accepte les champs vides et les entiers de 0 à 12", () => {
    expect(nclcIssue(empty)).toBeNull();
    expect(nclcIssue({ ...empty, fr_co: "0", fr_ce: "7", en_ee: "12" })).toBeNull();
  });

  it("signale les niveaux hors limites, décimaux ou négatifs", () => {
    expect(nclcIssue({ ...empty, fr_co: "13" })).toMatch(/1 épreuve/);
    expect(nclcIssue({ ...empty, fr_co: "7.5", en_co: "-1" })).toMatch(/2 épreuves/);
  });
});
