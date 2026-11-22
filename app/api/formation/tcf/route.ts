import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { newId } from "@/lib/ids";
import { QuizAIError } from "@/lib/quizAI";
import {
  currentEstimates,
  kindFor,
  planFor,
  tcfWeek,
  withParts,
  type TestKind,
} from "@/lib/tcf";
import { TCF_MODEL, research } from "@/lib/tcfAI";
import { loadTests, tcfToday } from "@/lib/tcfStore";

// La recherche de documents sur internet prend en général 30 à 90 secondes.
export const maxDuration = 300;

/** Tests du jour (l'écran interroge cette adresse pendant la préparation). */
export async function GET() {
  try {
    const { supabase, dossierId } = await requireOwner();
    const tests = await loadTests(supabase, dossierId, { day: tcfToday() });
    return NextResponse.json(
      { tests },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Crée le test du jour : positionnement tant qu'aucun n'a été passé, TCF blanc le samedi,
 * sinon l'épreuve de la rotation. Le contenu est ensuite préparé morceau par morceau.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as {
      kind?: TestKind;
    };
    const day = tcfToday();
    const history = await loadTests(supabase, dossierId, { limit: 40 });
    const placed = history.some((t) => t.kind === "positionnement");
    const kind: TestKind =
      body.kind === "blanc" && placed ? "blanc" : kindFor(day, placed);

    const existing = history.find((t) => t.day === day && t.kind === kind);
    if (existing) return NextResponse.json({ test: existing });

    const done = history.filter(
      (t) =>
        t.status === "corrige" ||
        Object.values(t.progress).some((p) => p.result),
    );
    const planned = planFor(kind, day, currentEstimates(done));
    if (!planned)
      return NextResponse.json(
        { error: "Le programme ne prévoit plus de test : place au repos et à la relecture du carnet avant l'examen." },
        { status: 409 },
      );
    const { title, sections } = planned;
    const plan = withParts(sections);
    const found = await research(day, tcfWeek(day)?.theme);

    const row = {
      id: newId("tcf"),
      dossier_id: dossierId,
      day,
      kind,
      title,
      plan,
      research: found.notes,
      sources: found.sources,
      model: TCF_MODEL,
    };
    const { error } = await supabase.from("tcf_test").insert(row);
    if (error) {
      // Deux créations simultanées : on renvoie celle qui a gagné.
      const again = (await loadTests(supabase, dossierId, { day })).find(
        (t) => t.kind === kind,
      );
      if (again) return NextResponse.json({ test: again });
      throw error;
    }
    const [test] = await loadTests(supabase, dossierId, { id: row.id });
    return NextResponse.json({ test });
  } catch (e) {
    if (e instanceof QuizAIError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
