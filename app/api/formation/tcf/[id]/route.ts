import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { QuizAIError } from "@/lib/quizAI";
import {
  EPREUVE_SHORT,
  currentEstimates,
  gradeComprehension,
  isComprehension,
  levelFromNote,
  mapTcfRow,
  nclcOf,
  sectionQuestions,
  sectionTasks,
  type SectionProgress,
  type SectionResult,
} from "@/lib/tcf";
import { gradeExpression } from "@/lib/tcfAI";
import { loadFullTest, loadTests } from "@/lib/tcfStore";

// La correction des expressions par Claude peut prendre une à deux minutes.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const [test] = await loadTests(supabase, dossierId, { id });
    if (!test)
      return NextResponse.json({ error: "Test introuvable." }, { status: 404 });
    return NextResponse.json(
      { test },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Démarre une section (le chronomètre part du serveur : recharger la page ne le remet pas à zéro)
 * ou la rend pour correction.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => null)) as {
      section?: number;
      action?: "start" | "submit";
      answers?: Record<string, unknown>;
    } | null;
    const si = Number(body?.section);
    const full = await loadFullTest(supabase, dossierId, id);
    if (!full)
      return NextResponse.json({ error: "Test introuvable." }, { status: 404 });
    const section = full.row.plan.sections[si];
    if (!section || !body?.action)
      return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
    const progress: Record<string, SectionProgress> = {
      ...(full.row.progress ?? {}),
    };
    const cur = progress[String(si)] ?? {};
    const reply = async () => {
      const [test] = await loadTests(supabase, dossierId, { id });
      return NextResponse.json({ test });
    };

    if (body.action === "start") {
      if (!cur.started_at) {
        progress[String(si)] = { ...cur, started_at: new Date().toISOString() };
        await supabase.from("tcf_test").update({ progress }).eq("id", id);
      }
      return reply();
    }

    if (cur.submitted_at) return reply();
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.answers ?? {}))
      if (typeof v === "string") answers[k.slice(0, 20)] = v.slice(0, 6000);

    // Version complète du test (avec les bonnes réponses) pour corriger.
    const full_ = mapTcfRow(
      {
        ...full.row,
        progress: { ...progress, [String(si)]: { ...cur, submitted_at: "x" } },
      },
      full.parts,
    );
    let result: SectionResult;
    if (isComprehension(section.epreuve)) {
      const others = (
        await loadTests(supabase, dossierId, { limit: 30 })
      ).filter((t) => t.id !== id);
      result = gradeComprehension(
        section.epreuve,
        sectionQuestions(full_, si),
        answers,
        currentEstimates(others)[section.epreuve],
      );
    } else {
      const grade = await gradeExpression(
        section.epreuve as "ee" | "eo",
        sectionTasks(full_, si),
        answers,
      );
      result = {
        epreuve: section.epreuve,
        value: grade.note_globale,
        level: levelFromNote(grade.note_globale),
        nclc: nclcOf(section.epreuve, grade.note_globale),
        grade,
      };
    }

    // Relecture juste avant d'écrire : une autre section a pu être rendue entre-temps.
    const { data: fresh } = await supabase
      .from("tcf_test")
      .select("progress")
      .eq("id", id)
      .single();
    const merged: Record<string, SectionProgress> = {
      ...((fresh?.progress as Record<string, SectionProgress>) ?? {}),
    };
    if (merged[String(si)]?.submitted_at) return reply();
    merged[String(si)] = {
      ...merged[String(si)],
      ...cur,
      submitted_at: new Date().toISOString(),
      answers,
      result,
    };

    const allDone = full.row.plan.sections.every(
      (_, i) => merged[String(i)]?.submitted_at,
    );
    const patch: Record<string, unknown> = { progress: merged };
    if (allDone) {
      const results = full.row.plan.sections
        .map((_, i) => merged[String(i)].result!)
        .filter(Boolean);
      const values = Object.fromEntries(
        results.map((r) => [r.epreuve, r.value]),
      );
      const line = results
        .map(
          (r) =>
            `${EPREUVE_SHORT[r.epreuve]} ${r.level} (${r.value}${isComprehension(r.epreuve) ? "/699" : "/20"}, NCLC ${r.nclc})`,
        )
        .join(" · ");
      const advice = results
        .map((r) => r.grade?.bilan)
        .filter(Boolean)
        .join(" ");
      patch.status = "corrige";
      patch.corrected_at = new Date().toISOString();
      patch.summary = {
        values,
        bilan: [line, advice].filter(Boolean).join("\n"),
      };
    }
    const { error } = await supabase
      .from("tcf_test")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    // Examen blanc et positionnement : les scores rejoignent l'onglet Scores, comme ceux faits ailleurs.
    if (allDone && full.row.kind !== "quotidien") {
      const v = (patch.summary as { values: Record<string, number> }).values;
      const { error: scoreErr } = await supabase.from("training_score").upsert({
        id: `sc-${id}`,
        dossier_id: dossierId,
        exam: "tcf",
        label: full.row.kind === "blanc" ? `${full.row.title} (application)` : "Diagnostic (positionnement)",
        taken_on: full.row.day,
        s1: v.co ?? null,
        s2: v.ce ?? null,
        s3: v.ee ?? null,
        s4: v.eo ?? null,
      });
      if (scoreErr) console.error("[tcf] score", scoreErr.message);
    }
    return reply();
  } catch (e) {
    if (e instanceof QuizAIError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
