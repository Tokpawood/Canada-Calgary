import { describe, expect, it } from "vitest";
import { apiErrorText } from "./quizAI";

describe("erreurs de l'API Claude", () => {
  it("distingue crédit, accès, attente, panne et rejet", () => {
    expect(apiErrorText({ status: 400, message: "Your credit balance is too low" })).toMatch(/crédit/);
    expect(apiErrorText({ status: 400, message: "You have reached your specified API usage limits" })).toMatch(/plafond/);
    expect(apiErrorText({ status: 404, message: "model not found" })).toMatch(/modèle/);
    expect(apiErrorText({ message: "timed out" })).toMatch(/à temps/);
    expect(apiErrorText({ status: 529, message: "overloaded" })).toMatch(/surchargé/);
    expect(apiErrorText({ status: 400, message: "invalid schema" })).toMatch(/rejeté.*400/);
  });
});
