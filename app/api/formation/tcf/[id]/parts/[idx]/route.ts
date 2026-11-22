import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import type { ErrorEntry, Lang } from "@/lib/formation";
import { QuizAIError } from "@/lib/quizAI";
import {
  buildPartPrompt,
  currentEstimates,
  partSpec,
  recentThemes,
} from "@/lib/tcf";
import { generatePart } from "@/lib/tcfAI";
import { loadTests } from "@/lib/tcfStore";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; idx: string }> };

/** Une préparation en cours depuis plus longtemps est considérée comme perdue. */
const STALE_MS = 5.5 * 60_000;

/** Prépare un morceau du test (idempotent : un morceau prêt ou en cours n'est pas refait). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id, idx: rawIdx } = await params;
  const idx = Number(rawIdx);
  try {
    const { supabase, dossierId } = await requireOwner();
    const { data: row } = await supabase
      .from("tcf_test")
      .select("id, day, plan, research")
      .eq("dossier_id", dossierId)
      .eq("id", id)
      .maybeSingle();
    if (!row)
      return NextResponse.json({ error: "Test introuvable." }, { status: 404 });
    const spec = partSpec(row.plan, idx);
    if (!spec)
      return NextResponse.json({ error: "Morceau inconnu." }, { status: 400 });

    // Réservation du morceau.
    const { data: cur } = await supabase
      .from("tcf_test_part")
      .select("status, updated_at")
      .eq("test_id", id)
      .eq("idx", idx)
      .maybeSingle();
    if (cur?.status === "pret") return NextResponse.json({ status: "pret" });
    if (
      cur?.status === "en_cours" &&
      Date.now() - new Date(cur.updated_at as string).getTime() < STALE_MS
    )
      return NextResponse.json({ status: "en_cours" });
    const claim = {
      test_id: id,
      idx,
      dossier_id: dossierId,
      status: "en_cours",
      content: null,
      error: null,
      updated_at: new Date().toISOString(),
    };
    if (cur) {
      const { data: won } = await supabase
        .from("tcf_test_part")
        .update(claim)
        .eq("test_id", id)
        .eq("idx", idx)
        .eq("updated_at", cur.updated_at)
        .select("idx");
      if (!won?.length) return NextResponse.json({ status: "en_cours" });
    } else {
      const { error } = await supabase.from("tcf_test_part").insert(claim);
      if (error) return NextResponse.json({ status: "en_cours" });
    }

    try {
      const [{ data: errorRows }, history, { data: memoRows }] = await Promise.all([
        supabase
          .from("training_error")
          .select("*")
          .eq("dossier_id", dossierId)
          .eq("exam", "tcf")
          .order("count", { ascending: false })
          .limit(30),
        loadTests(supabase, dossierId, { limit: 30 }),
        supabase
          .from("training_memo")
          .select("title")
          .eq("dossier_id", dossierId)
          .eq("exam", "tcf")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
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
      const others = history.filter((t) => t.id !== id);
      const prompt = buildPartPrompt({
        section: spec.section,
        part: spec.part,
        research: (row.research as string) ?? "",
        estimate: currentEstimates(others)[spec.section.epreuve],
        avoid: recentThemes(history, row.day as string),
        errors,
        today: row.day as string,
        memos: (memoRows ?? []).map((m) => m.title as string).filter(Boolean),
      });
      const content = await generatePart(spec.section, spec.part, prompt);
      await supabase
        .from("tcf_test_part")
        .update({
          status: "pret",
          content,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("test_id", id)
        .eq("idx", idx);
      return NextResponse.json({ status: "pret" });
    } catch (e) {
      const message =
        e instanceof QuizAIError
          ? e.message
          : "La préparation de cette partie a échoué.";
      await supabase
        .from("tcf_test_part")
        .update({
          status: "erreur",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("test_id", id)
        .eq("idx", idx);
      if (!(e instanceof QuizAIError)) console.error("[tcf] morceau", idx, e);
      return NextResponse.json(
        { error: message },
        { status: e instanceof QuizAIError ? e.status : 500 },
      );
    }
  } catch (e) {
    return errorResponse(e);
  }
}
