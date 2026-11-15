import { describe, expect, it } from "vitest";
import { formatCreatedAt, formatLastSignIn } from "./compte";

describe("dates de la page Compte", () => {
  it("formate à l'heure de Calgary, quel que soit le fuseau de la machine", () => {
    // 03:30 UTC le 16 novembre = 20:30 le 15 novembre à Calgary (UTC−7 en hiver).
    expect(formatLastSignIn("2026-11-16T03:30:00Z")).toEqual({ day: "15 nov.", time: "20:30" });
    // 1er janvier 05:00 UTC = 31 décembre 22:00 à Calgary : le mois et l'année suivent le fuseau.
    expect(formatCreatedAt("2026-01-01T05:00:00Z")).toBe("déc. 2025");
  });

  it("renvoie null pour une date absente ou illisible", () => {
    expect(formatLastSignIn(null)).toBeNull();
    expect(formatLastSignIn("pas une date")).toBeNull();
    expect(formatCreatedAt(null)).toBeNull();
  });
});
