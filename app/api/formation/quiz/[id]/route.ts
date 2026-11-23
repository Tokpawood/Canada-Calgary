import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { usageSink } from "@/lib/aiUsageStore";
import { QuizAIError, gradeOpen } from "@/lib/quizAI";
import { CLOSED_KINDS, gradeClosed, mapQuizRow, scoreOf, type ItemResult, type QuizRow } from "@/lib/quiz";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** Corrige la série : réponses fermées sur place, réponses ouvertes par Claude ; les fautes refaites remontent dans le carnet. */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => null)) as { answers?: Record<string, unknown> } | null;

    const { data } = await supabase.from("training_quiz").select("*").eq("id", id).eq("dossier_id", dossierId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Série introuvable." }, { status: 404 });
    const row = data as QuizRow;
    if (row.status === "corrige") return NextResponse.json({ quiz: mapQuizRow(row) });

    const answers: Record<string, string> = {};
    for (const it of row.items) {
      const v = body?.answers?.[it.id];
      answers[it.id] = typeof v === "string" ? v.slice(0, 2000) : "";
    }

    const open = row.items.filter((it) => !CLOSED_KINDS.includes(it.kind));
    const graded = open.length ? await gradeOpen(open, answers, usageSink(supabase, dossierId, "correction exercices")) : { results: [] as ItemResult[], summary: "" };
    const results: ItemResult[] = row.items.map((it) =>
      CLOSED_KINDS.includes(it.kind) ? gradeClosed(it, answers[it.id]) : (graded.results.find((r) => r.id === it.id) ?? { id: it.id, score: 0, feedback: "", corrected: it.accepted[0] ?? "" }),
    );
    const score = scoreOf(results);
    const summary = graded.summary || (score === row.total ? "Tout est juste : ces règles sont acquises." : "Relisez les explications des exercices ratés.");

    const { data: saved, error } = await supabase
      .from("training_quiz")
      .update({ answers, results: { items: results, summary }, score, status: "corrige", corrected_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pret")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!saved) {
      const { data: done } = await supabase.from("training_quiz").select("*").eq("id", id).maybeSingle();
      return NextResponse.json({ quiz: mapQuizRow(done as QuizRow) });
    }

    // Une erreur du carnet ratée de nouveau : compteur +1 et de nouveau « à retravailler ».
    const missed = [...new Set(row.items.filter((it, i) => it.error_id && results[i].score < 1).map((it) => it.error_id))];
    const bumped: string[] = [];
    if (missed.length) {
      const { data: errs } = await supabase.from("training_error").select("id, count").eq("dossier_id", dossierId).in("id", missed);
      for (const e of errs ?? []) {
        const { error: upErr } = await supabase
          .from("training_error")
          .update({ count: Math.min(999, Number(e.count) + 1), mastered: false, updated_at: new Date().toISOString() })
          .eq("id", e.id);
        if (!upErr) bumped.push(e.id as string);
      }
    }
    return NextResponse.json({ quiz: mapQuizRow(saved as QuizRow), bumped });
  } catch (e) {
    if (e instanceof QuizAIError) return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
