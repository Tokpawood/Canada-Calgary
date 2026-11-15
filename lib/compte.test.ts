import { describe, expect, it } from "vitest";
import { formatCreatedAt, formatLastSignIn } from "./compte";

describe("dates de la page Compte", () => {
  it("formate à l'heure d'Abidjan, quel que soit le fuseau de la machine", () => {
    // Abidjan = UTC+0 toute l'année : 23:30 UTC le 15 novembre reste le 15 à 23:30.
    expect(formatLastSignIn("2026-11-15T23:30:00Z")).toEqual({ day: "15 nov.", time: "23:30" });
    // 31 décembre 23:59 UTC : toujours décembre à Abidjan.
    expect(formatCreatedAt("2025-12-31T23:59:00Z")).toBe("déc. 2025");
  });

  it("renvoie null pour une date absente ou illisible", () => {
    expect(formatLastSignIn(null)).toBeNull();
    expect(formatLastSignIn("pas une date")).toBeNull();
    expect(formatCreatedAt(null)).toBeNull();
  });
});
