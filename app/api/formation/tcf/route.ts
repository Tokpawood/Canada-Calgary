import { NextResponse, after, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { RESEARCH_REUSE_DAYS, canReuseResearch } from "@/lib/aiUsage";
import { usageSink } from "@/lib/aiUsageStore";
import { newId } from "@/lib/ids";
import { QuizAIError } from "@/lib/quizAI";
import {
  currentEstimates,
  RESEARCH_STALE_MS,
  kindFor,
  planFor,
  tcfWeek,
  withParts,
  type Plan,
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
    if (existing) {
      // Recherche interrompue (serveur arrêté en route) : on la relance.
      const since = existing.plan.researching_since;
      const stale =
        !!since && Date.now() - new Date(since).getTime() > RESEARCH_STALE_MS;
      // Préparation en panne dès le départ (crédit épuisé…) : la recherche n'a rien donné non plus.
      const states = Object.values(existing.parts).map((p) => p?.status);
      const empty =
        !since &&
        !existing.sources.length &&
        states.length > 0 &&
        states.every((x) => x === "erreur");
      if (stale || empty) {
        const plan: Plan = {
          ...existing.plan,
          researching_since: new Date().toISOString(),
        };
        await supabase.from("tcf_test").update({ plan }).eq("id", existing.id);
        after(() =>
          runResearch(supabase, dossierId, existing.id, day, plan),
        );
        existing.plan = plan;
      }
      return NextResponse.json({ test: existing });
    }

    const done = history.filter(
      (t) =>
        t.status === "corrige" ||
        Object.values(t.progress).some((p) => p.result),
    );
    const planned = planFor(kind, day, currentEstimates(done));
    if (!planned)
      return NextResponse.json(
        {
          error:
            "Le programme ne prévoit plus de test : place au repos et à la relecture du carnet avant l'examen.",
        },
        { status: 409 },
      );
    const { title, sections } = planned;
    const plan: Plan = {
      ...withParts(sections),
      researching_since: new Date().toISOString(),
    };

    const row = {
      id: newId("tcf"),
      dossier_id: dossierId,
      day,
      kind,
      title,
      plan,
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
    // La recherche sur internet (1 à 2 min) se fait après la réponse : Safari sur iPad abandonne
    // une requête restée plus d'une minute sans réponse.
    after(() => runResearch(supabase, dossierId, row.id, day, plan));
    const [test] = await loadTests(supabase, dossierId, { id: row.id });
    return NextResponse.json({ test });
  } catch (e) {
    if (e instanceof QuizAIError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}

async function runResearch(
  supabase: SupabaseClient,
  dossierId: string,
  id: string,
  day: string,
  plan: Plan,
) {
  let found: { notes: string; sources: Array<{ url: string; title: string }> } =
    { notes: "", sources: [] };
  let origin = day;
  try {
    // Notes de moins de 3 jours : on les réutilise au lieu de relancer une recherche payante.
    const from = new Date(
      Date.parse(`${day}T00:00:00Z`) - (RESEARCH_REUSE_DAYS - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const { data: past } = await supabase
      .from("tcf_test")
      .select("day, plan, research, sources")
      .eq("dossier_id", dossierId)
      .gte("day", from)
      .neq("id", id)
      .neq("research", "")
      .order("day", { ascending: false });
    const dayOf = (t: { day: unknown; plan: unknown }) =>
      (t.plan as Plan).research_day ?? (t.day as string);
    const reuse = (past ?? []).find((t) => canReuseResearch(dayOf(t), day));
    if (reuse) {
      origin = dayOf(reuse);
      found = {
        notes: reuse.research as string,
        sources: reuse.sources as typeof found.sources,
      };
    } else
      found = await research(
        day,
        tcfWeek(day)?.theme,
        usageSink(supabase, dossierId, "recherche"),
      );
  } catch (e) {
    // Sans notes de recherche, les parties s'appuient sur des sujets d'actualité plausibles.
    console.error("[tcf] recherche", e instanceof Error ? e.message : e);
  }
  const { researching_since: _, ...rest } = plan;
  void _;
  const { error } = await supabase
    .from("tcf_test")
    .update({ plan: { ...rest, research_day: origin }, research: found.notes, sources: found.sources })
    .eq("id", id);
  if (error)
    console.error("[tcf] enregistrement de la recherche", error.message);
}
