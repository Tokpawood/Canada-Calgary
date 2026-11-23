import { describe, expect, it } from "vitest";
import {
  apiErrorText,
  callCost,
  canReuseResearch,
  isAccountError,
  monthProjection,
  usageBy,
  usageTotals,
} from "./aiUsage";

describe("consommation de l'API Claude", () => {
  it("estime le coût d'un appel", () => {
    const u = { input_tokens: 1_000_000, output_tokens: 100_000 };
    expect(callCost("claude-sonnet-5-5", u)).toBeCloseTo(3);
    expect(callCost("claude-opus-5-5", u)).toBeCloseTo(6);
    expect(
      callCost("claude-sonnet-5-5", {
        input_tokens: 0,
        output_tokens: 0,
        server_tool_use: { web_search_requests: 3 },
      }),
    ).toBeCloseTo(0.03);
  });

  it("réutilise une recherche 3 jours au plus", () => {
    expect(canReuseResearch("2026-11-22", "2026-11-24")).toBe(true);
    expect(canReuseResearch("2026-11-22", "2026-11-25")).toBe(false);
    expect(canReuseResearch("2026-11-30", "2026-12-01")).toBe(true);
  });

  it("totaux du jour et du mois", () => {
    const rows = [
      { day: "2026-10-31", task: "questions", cost_usd: 9 },
      { day: "2026-11-22", task: "questions", cost_usd: 1 },
      { day: "2026-11-23", task: "recherche", cost_usd: 0.5 },
    ];
    expect(usageTotals(rows, "2026-11-23")).toEqual({
      today: 0.5,
      month: 1.5,
      perDay: 0.75,
      days: 2,
    });
    expect(usageBy(rows, (r) => r.task)).toEqual([
      { key: "questions", cost: 10, calls: 2 },
      { key: "recherche", cost: 0.5, calls: 1 },
    ]);
    const t = { month: 3, perDay: 1, days: 2 };
    expect(monthProjection(t, "2026-11-23")).toBeNull();
    expect(monthProjection({ ...t, days: 3 }, "2026-11-23")).toBe(10);
  });

  it("distingue crédit, clé, accès, attente, panne et rejet", () => {
    const credit = apiErrorText({
      status: 400,
      message: "Your credit balance is too low",
    });
    expect(isAccountError(credit)).toBe(true);
    expect(
      apiErrorText({ status: 400, message: "reached your API usage limits" }),
    ).toBe(credit);
    expect(isAccountError(apiErrorText({ status: 401, message: "x" }))).toBe(
      true,
    );
    expect(isAccountError(apiErrorText({ status: 529, message: "x" }))).toBe(
      false,
    );
    expect(apiErrorText({ status: 404, message: "x" })).toMatch(/modèle/);
    expect(apiErrorText({ message: "timed out" })).toMatch(/à temps/);
    expect(apiErrorText({ status: 400, message: "x" })).toMatch(/rejeté/);
  });
});
