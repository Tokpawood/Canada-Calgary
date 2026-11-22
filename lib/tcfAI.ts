/**
 * Appels à Claude pour les tests TCF (serveur uniquement).
 * 1. Recherche sur internet de documents authentiques récents (Sonnet + recherche web).
 * 2. Rédaction des questions, morceau par morceau (Opus, sortie structurée).
 * 3. Correction des expressions écrite et orale selon la grille TCF (Opus).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { QuizAIError, apiError, ask, client } from "./quizAI";
import {
  CePartSchema,
  CoPartSchema,
  EePartSchema,
  EoPartSchema,
  EXPR_GRADE_SYSTEM,
  ExprGradeSchema,
  RESEARCH_SYSTEM,
  TCF_SYSTEM,
  buildExprGradePrompt,
  finalizeQuestions,
  type EeTask,
  type EoTask,
  type Level,
  type PartContent,
  type Section,
} from "./tcf";

export const TCF_MODEL = "claude-opus-5-5";
const RESEARCH_MODEL = "claude-sonnet-5-5";

/** Cherche des documents authentiques récents. En cas d'échec, le test se prépare sans (notes vides). */
export async function research(
  today: string,
): Promise<{ notes: string; sources: Array<{ url: string; title: string }> }> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Nous sommes le ${today}. Prépare les notes de recherche pour le test TCF Canada du jour. Les faits récents changent : cherche-les plutôt que de te fier à ta mémoire.`,
    },
  ];
  const sources = new Map<string, string>();
  try {
    let res: Anthropic.Message | null = null;
    for (let turn = 0; turn < 4; turn++) {
      res = await client().messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 8000,
        system: RESEARCH_SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 6 },
        ],
        messages,
      });
      for (const b of res.content)
        if (b.type === "web_search_tool_result" && Array.isArray(b.content))
          for (const r of b.content)
            if (!sources.has(r.url)) sources.set(r.url, r.title);
      if (res.stop_reason !== "pause_turn") break;
      // Recherche longue mise en pause : on renvoie la réponse telle quelle pour que le serveur reprenne.
      messages.splice(1, messages.length - 1, {
        role: "assistant",
        content: res.content,
      });
    }
    const notes = (res?.content ?? [])
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return {
      notes: notes.slice(0, 20_000),
      sources: [...sources]
        .slice(0, 30)
        .map(([url, title]) => ({ url, title })),
    };
  } catch (e) {
    try {
      apiError(e);
    } catch (mapped) {
      // Clé refusée ou absente : inutile d'aller plus loin.
      if (mapped instanceof QuizAIError && mapped.status === 503) throw mapped;
    }
    console.error(
      "[tcf] recherche web indisponible",
      e instanceof Error ? e.message : e,
    );
    return { notes: "", sources: [] };
  }
}

/** Rédige un morceau du test. */
export async function generatePart(
  section: Section,
  part: { from: number; to: number },
  prompt: string,
): Promise<PartContent> {
  const opts = { model: TCF_MODEL, maxTokens: 32000 };
  if (section.epreuve === "co" || section.epreuve === "ce") {
    const levels = (section.levels ?? []).slice(part.from, part.to) as Level[];
    const out =
      section.epreuve === "co"
        ? await ask(CoPartSchema, TCF_SYSTEM, prompt, "medium", opts)
        : await ask(CePartSchema, TCF_SYSTEM, prompt, "medium", opts);
    const items = finalizeQuestions(
      out.items as Array<(typeof out.items)[number]>,
      section.epreuve,
      part.from,
      levels,
    );
    if (items.length < levels.length)
      throw new QuizAIError(
        "Claude a renvoyé trop peu de questions. Nouvel essai…",
      );
    return { items } as PartContent;
  }
  const wanted = (section.tasks ?? []).slice(part.from, part.to).map(String);
  const out =
    section.epreuve === "ee"
      ? await ask(EePartSchema, TCF_SYSTEM, prompt, "medium", opts)
      : await ask(EoPartSchema, TCF_SYSTEM, prompt, "medium", opts);
  const tasks = wanted
    .map((t) => (out.tasks as Array<EeTask | EoTask>).find((x) => x.task === t))
    .filter((x): x is EeTask | EoTask => !!x);
  if (tasks.length < wanted.length)
    throw new QuizAIError("Claude a oublié une tâche. Nouvel essai…");
  return { tasks };
}

export async function gradeExpression(
  epreuve: "ee" | "eo",
  tasks: Array<EeTask | EoTask>,
  answers: Record<string, string>,
) {
  const out = await ask(
    ExprGradeSchema,
    EXPR_GRADE_SYSTEM,
    buildExprGradePrompt(epreuve, tasks, answers),
    "high",
    { model: TCF_MODEL, maxTokens: 24000 },
  );
  const clamp = (n: number) => Math.max(0, Math.min(20, Math.round(n)));
  return {
    ...out,
    note_globale: clamp(out.note_globale),
    tasks: out.tasks.map((t) => ({ ...t, note: clamp(t.note) })),
  };
}
