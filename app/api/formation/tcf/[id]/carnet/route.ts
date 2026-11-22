import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { errorKey } from "@/lib/errorImport";
import type { ErrorEntry } from "@/lib/formation";
import { newId } from "@/lib/ids";
import type { SectionProgress } from "@/lib/tcf";

type Ctx = { params: Promise<{ id: string }> };

/** Ajoute au carnet d'erreurs les fautes relevées dans une section d'expression corrigée. */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { supabase, dossierId } = await requireOwner();
    const body = (await request.json().catch(() => null)) as {
      section?: number;
    } | null;
    const { data: row } = await supabase
      .from("tcf_test")
      .select("plan, progress")
      .eq("dossier_id", dossierId)
      .eq("id", id)
      .maybeSingle();
    const si = String(Number(body?.section));
    const result = (
      row?.progress as Record<string, SectionProgress> | undefined
    )?.[si]?.result;
    if (!result?.grade)
      return NextResponse.json(
        { error: "Aucune correction à reprendre." },
        { status: 400 },
      );
    const skill =
      result.epreuve === "eo" ? "Expression orale" : "Expression écrite";

    const { data: existing } = await supabase
      .from("training_error")
      .select("id, wrong, count")
      .eq("dossier_id", dossierId)
      .eq("exam", "tcf");
    const byKey = new Map(
      (existing ?? []).map((e) => [errorKey(e.wrong as string), e]),
    );
    const now = new Date().toISOString();
    const added: ErrorEntry[] = [];
    const bumped: string[] = [];
    const seen = new Set<string>();
    for (const t of result.grade.tasks)
      for (const err of t.erreurs) {
        const k = errorKey(err.wrong);
        if (!err.wrong.trim() || seen.has(k)) continue;
        seen.add(k);
        const old = byKey.get(k);
        if (old) {
          await supabase
            .from("training_error")
            .update({
              count: Math.min(999, Number(old.count) + 1),
              mastered: false,
              updated_at: now,
            })
            .eq("id", old.id);
          bumped.push(old.id as string);
        } else {
          added.push({
            id: newId("err"),
            exam: "tcf",
            skill,
            wrong: err.wrong.slice(0, 500),
            correct: err.correct.slice(0, 500),
            rule: err.rule.slice(0, 500),
            count: 1,
            mastered: false,
            createdAt: now,
          });
        }
      }
    if (added.length) {
      const { error } = await supabase
        .from("training_error")
        .insert(
          added.map((r) => ({
            id: r.id,
            dossier_id: dossierId,
            exam: r.exam,
            skill: r.skill,
            wrong: r.wrong,
            correct: r.correct,
            rule: r.rule,
          })),
        );
      if (error) throw error;
    }
    return NextResponse.json({ added, bumped });
  } catch (e) {
    return errorResponse(e);
  }
}
