/**
 * Appels à Claude pour les exercices du jour (côté serveur uniquement : la clé ANTHROPIC_API_KEY
 * ne quitte jamais le serveur).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  GRADE_SYSTEM,
  GradeSchema,
  QUIZ_SYSTEM,
  QuizSchema,
  buildGradeContext,
  type ItemResult,
  type QuizItem,
} from "./quiz";
import * as z from "zod/v4";

export const QUIZ_MODEL = "claude-opus-5-5";

export class QuizAIError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/** Cause précise d'une erreur de l'API : crédit, accès, attente ou panne ne se règlent pas de la même façon. */
export function apiErrorText(e: { status?: number; message: string }): string {
  if (e.status === 402 || /credit balance|billing|usage limits?/i.test(e.message))
    return "Le crédit de l'API Claude est épuisé ou son plafond est atteint : rechargez-le sur platform.claude.com (Billing), puis réessayez.";
  if (e.status === 403 || e.status === 404)
    return `La clé API n'a pas accès au modèle demandé (code ${e.status}).`;
  if (e.status === undefined)
    return "Claude n'a pas répondu à temps. Réessayez dans quelques minutes.";
  if (e.status >= 500)
    return `Claude est surchargé ou en panne (code ${e.status}). Réessayez dans quelques minutes.`;
  return `Claude a rejeté la demande (code ${e.status}).`;
}

/** Erreurs de l'API traduites pour l'interface. */
export function apiError(e: unknown): never {
  if (e instanceof QuizAIError) throw e;
  if (e instanceof Anthropic.AuthenticationError)
    throw new QuizAIError(
      "La clé API Anthropic est refusée : vérifiez-la dans les réglages Vercel.",
      503,
    );
  if (e instanceof Anthropic.RateLimitError)
    throw new QuizAIError(
      "Trop de demandes envoyées à Claude. Réessayez dans une minute.",
      429,
    );
  if (e instanceof Anthropic.APIError) {
    console.error("[ia] Anthropic", e.status, e.message);
    throw new QuizAIError(apiErrorText(e));
  }
  throw e;
}

export function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new QuizAIError(
      "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur.",
      503,
    );
  return new Anthropic({ maxRetries: 2, timeout: 240_000 });
}

export async function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  content: string,
  effort: "low" | "medium" | "high",
  opts: { model?: string; maxTokens?: number } = {},
): Promise<z.infer<T>> {
  try {
    const res = await client().beta.messages.parse({
      model: opts.model ?? QUIZ_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      // En cas de refus par les filtres de sécurité, l'API relance la même demande sur un modèle de repli.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (res.stop_reason === "refusal")
      throw new QuizAIError(
        "Claude a refusé de préparer cette série. Réessayez plus tard.",
      );
    if (res.stop_reason === "max_tokens")
      throw new QuizAIError("La réponse de Claude a été coupée. Réessayez.");
    if (!res.parsed_output)
      throw new QuizAIError("Réponse de Claude illisible. Réessayez.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    apiError(e);
  }
}

export function generateQuiz(context: string) {
  return ask(QuizSchema, QUIZ_SYSTEM, context, "medium");
}

export async function gradeOpen(
  items: QuizItem[],
  answers: Record<string, string>,
): Promise<{ results: ItemResult[]; summary: string }> {
  const out = await ask(
    GradeSchema,
    GRADE_SYSTEM,
    buildGradeContext(items, answers),
    "medium",
  );
  const byId = new Map(out.results.map((r) => [r.id, r]));
  return {
    summary: out.summary,
    results: items.map((it) => {
      const r = byId.get(it.id);
      return r
        ? {
            id: it.id,
            score: Number(r.score),
            feedback: r.feedback,
            corrected: r.corrected,
          }
        : {
            id: it.id,
            score: 0,
            feedback: "Correction indisponible pour cet exercice.",
            corrected: it.accepted[0] ?? "",
          };
    }),
  };
}
