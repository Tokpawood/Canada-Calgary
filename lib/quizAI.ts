/**
 * Appels à Claude pour les exercices du jour (côté serveur uniquement : la clé ANTHROPIC_API_KEY
 * ne quitte jamais le serveur).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GRADE_SYSTEM, GradeSchema, QUIZ_SYSTEM, QuizSchema, buildGradeContext, type ItemResult, type QuizItem } from "./quiz";
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

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new QuizAIError("La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur.", 503);
  return new Anthropic({ maxRetries: 2, timeout: 240_000 });
}

async function ask<T extends z.ZodType>(schema: T, system: string, content: string, effort: "low" | "medium" | "high"): Promise<z.infer<T>> {
  try {
    const res = await client().beta.messages.parse({
      model: QUIZ_MODEL,
      max_tokens: 16000,
      // En cas de refus par les filtres de sécurité, l'API relance la même demande sur un modèle de repli.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (res.stop_reason === "refusal") throw new QuizAIError("Claude a refusé de préparer cette série. Réessayez plus tard.");
    if (res.stop_reason === "max_tokens") throw new QuizAIError("La réponse de Claude a été coupée. Réessayez.");
    if (!res.parsed_output) throw new QuizAIError("Réponse de Claude illisible. Réessayez.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof QuizAIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new QuizAIError("La clé API Anthropic est refusée : vérifiez-la dans les réglages Vercel.", 503);
    if (e instanceof Anthropic.RateLimitError) throw new QuizAIError("Trop de demandes envoyées à Claude. Réessayez dans une minute.", 429);
    if (e instanceof Anthropic.APIError) {
      console.error("[quiz] Anthropic", e.status, e.message);
      throw new QuizAIError("Claude est indisponible pour le moment. Réessayez plus tard.");
    }
    throw e;
  }
}

export function generateQuiz(context: string) {
  return ask(QuizSchema, QUIZ_SYSTEM, context, "medium");
}

export async function gradeOpen(items: QuizItem[], answers: Record<string, string>): Promise<{ results: ItemResult[]; summary: string }> {
  const out = await ask(GradeSchema, GRADE_SYSTEM, buildGradeContext(items, answers), "medium");
  const byId = new Map(out.results.map((r) => [r.id, r]));
  return {
    summary: out.summary,
    results: items.map((it) => {
      const r = byId.get(it.id);
      return r
        ? { id: it.id, score: Number(r.score), feedback: r.feedback, corrected: r.corrected }
        : { id: it.id, score: 0, feedback: "Correction indisponible pour cet exercice.", corrected: it.accepted[0] ?? "" };
    }),
  };
}
