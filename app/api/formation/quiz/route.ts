import { NextResponse } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { createAdminClient } from "@/lib/supabase/admin";
import { usageSink } from "@/lib/aiUsageStore";
import { newId } from "@/lib/ids";
import type { ErrorEntry, Lang, MemoEntry } from "@/lib/formation";
import { QuizAIError, QUIZ_MODEL, generateQuiz } from "@/lib/quizAI";
import { tcfDigest } from "@/lib/tcf";
import { loadTests } from "@/lib/tcfStore";
import { buildQuizContext, finalizeItems, mapQuizRow, type QuizHistoryEntry, type QuizRow } from "@/lib/quiz";

// La préparation de la série par Claude peut prendre une à deux minutes.
export const maxDuration = 300;

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });

/** Série du jour si elle existe déjà (l'écran interroge cette adresse pendant la préparation). */
export async function GET() {
  try {
    const { supabase, dossierId } = await requireOwner();
    const { data } = await supabase.from("training_quiz").select("*").eq("dossier_id", dossierId).eq("day", today()).eq("exam", "tcf").maybeSingle();
    return NextResponse.json({ quiz: data ? mapQuizRow(data as QuizRow) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Prépare la série du jour (une seule par jour : si elle existe déjà, elle est renvoyée telle quelle). */
export async function POST() {
  try {
    const { dossierId } = await requireOwner();
    // Travail long : la session de l'utilisateur ne doit ni expirer en route ni être renouvelée ici
    // (le nouveau jeton serait perdu et Supabase fermerait la session).
    const supabase = createAdminClient();
    const day = today();

    const { data: existing } = await supabase.from("training_quiz").select("*").eq("dossier_id", dossierId).eq("day", day).eq("exam", "tcf").maybeSingle();
    if (existing) return NextResponse.json({ quiz: mapQuizRow(existing as QuizRow) });

    const [{ data: errorRows }, { data: memoRows }, { data: past }, tests] = await Promise.all([
      supabase.from("training_error").select("*").eq("dossier_id", dossierId),
      supabase.from("training_memo").select("id, exam, title, body, created_at").eq("dossier_id", dossierId).order("created_at", { ascending: false }),
      supabase.from("training_quiz").select("day, items, results, score, total").eq("dossier_id", dossierId).eq("exam", "tcf").order("day", { ascending: false }).limit(7),
      loadTests(supabase, dossierId, { limit: 12 }).catch(() => []),
    ]);
    const tcf = tcfDigest(tests);

    const errors: ErrorEntry[] = (errorRows ?? []).map((r) => ({
      id: r.id as string,
      exam: r.exam as Lang,
      skill: (r.skill as string) ?? "",
      wrong: r.wrong as string,
      correct: (r.correct as string) ?? "",
      rule: (r.rule as string) ?? "",
      count: Number(r.count ?? 1),
      mastered: Boolean(r.mastered),
      createdAt: r.created_at as string,
    }));
    const memos: MemoEntry[] = (memoRows ?? []).map((r) => ({ id: r.id as string, exam: r.exam as Lang, title: r.title as string, body: (r.body as string) ?? "", createdAt: r.created_at as string }));
    const history: QuizHistoryEntry[] = (past ?? []).map((q) => ({
      day: q.day as string,
      score: q.score == null ? null : Number(q.score),
      total: q.total as number,
      items: (q.items as QuizHistoryEntry["items"]) ?? [],
      results: (q.results as { items: QuizHistoryEntry["results"] } | null)?.items ?? null,
    }));

    if (!errors.some((e) => e.exam === "tcf") && !memos.some((m) => m.exam === "tcf") && !tcf) {
      return NextResponse.json({ error: "Ajoutez d'abord quelques erreurs au carnet, une leçon à l'aide-mémoire ou passez un test TCF Canada : la série s'appuie dessus." }, { status: 400 });
    }

    const out = await generateQuiz(buildQuizContext({ today: day, errors, memos, history, tcf }), usageSink(supabase, dossierId, "exercices"));
    const items = finalizeItems(out.items);
    if (items.length === 0) throw new QuizAIError("Claude n'a renvoyé aucun exercice. Réessayez.");
    // Seules les erreurs réellement présentes au carnet sont rattachées.
    const known = new Set(errors.map((e) => e.id));
    for (const it of items) if (it.error_id && !known.has(it.error_id)) it.error_id = "";

    const row = { id: newId("quiz"), dossier_id: dossierId, day, exam: "tcf", title: out.title.slice(0, 200), focus: out.focus.slice(0, 500), items, total: items.length, model: QUIZ_MODEL };
    const { data: saved, error } = await supabase.from("training_quiz").insert(row).select("*").single();
    if (error) {
      // Deux préparations lancées en même temps : on renvoie celle qui a gagné.
      const { data: again } = await supabase.from("training_quiz").select("*").eq("dossier_id", dossierId).eq("day", day).eq("exam", "tcf").maybeSingle();
      if (again) return NextResponse.json({ quiz: mapQuizRow(again as QuizRow) });
      throw error;
    }
    return NextResponse.json({ quiz: mapQuizRow(saved as QuizRow) });
  } catch (e) {
    if (e instanceof QuizAIError) return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
