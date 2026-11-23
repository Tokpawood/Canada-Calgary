import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser } from "@/lib/queries";
import { FormationBoard } from "@/components/formation/FormationBoard";
import type {
  ErrorEntry,
  Lang,
  MemoEntry,
  TrainingScore,
} from "@/lib/formation";
import { mapQuizRow, type QuizRow } from "@/lib/quiz";
import { loadTests } from "@/lib/tcfStore";

export const metadata = {
  title: "Formation TCF · IELTS — Projet Canada Calgary",
};

export default async function FormationPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; t?: string }>;
}) {
  const { d, t } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [
    { data: checks },
    { data: scoreRows },
    { data: errorRows },
    { data: memoRows },
    { data: quizRows },
    { data: usageRows },
  ] = await Promise.all([
    supabase
      .from("training_check")
      .select("item_key")
      .eq("dossier_id", dossier.id),
    supabase
      .from("training_score")
      .select("*")
      .eq("dossier_id", dossier.id)
      .order("taken_on", { ascending: true }),
    supabase
      .from("training_error")
      .select("*")
      .eq("dossier_id", dossier.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_memo")
      .select("id, exam, title, body, created_at")
      .eq("dossier_id", dossier.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_quiz")
      .select("*")
      .eq("dossier_id", dossier.id)
      .eq("exam", "tcf")
      .order("day", { ascending: false })
      .limit(60),
    supabase
      .from("ai_usage")
      .select("day, cost_usd")
      .eq("dossier_id", dossier.id)
      .gte(
        "day",
        `${new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" }).slice(0, 7)}-01`,
      ),
  ]);
  const quizzes = (quizRows ?? []).map((r) => mapQuizRow(r as QuizRow));
  // Les tests TCF sont facultatifs : une table absente (migration non appliquée) ne bloque pas la page.
  const tcfTests = await loadTests(supabase, dossier.id, { limit: 60 }).catch(
    () => [],
  );

  const memos: MemoEntry[] = (memoRows ?? []).map((r) => ({
    id: r.id as string,
    exam: r.exam as Lang,
    title: r.title as string,
    body: (r.body as string) ?? "",
    createdAt: r.created_at as string,
  }));

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

  const num = (v: unknown) => (v == null ? null : Number(v));
  const scores: TrainingScore[] = (scoreRows ?? []).map((r) => ({
    id: r.id as string,
    exam: r.exam as Lang,
    label: (r.label as string) ?? "",
    takenOn: (r.taken_on as string | null) ?? null,
    scores: [num(r.s1), num(r.s2), num(r.s3), num(r.s4)],
    notes: (r.notes as string) ?? "",
  }));

  // Date du jour à Abidjan (fuseau du titulaire), identique côté serveur et navigateur.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Abidjan",
  });

  return (
    <FormationBoard
      dossierId={dossier.id}
      today={today}
      initialDone={(checks ?? []).map((c) => c.item_key as string)}
      initialScores={scores}
      initialErrors={errors}
      initialMemos={memos}
      initialQuizzes={quizzes}
      initialTests={tcfTests}
      usage={(usageRows ?? []).map((r) => ({
        day: r.day as string,
        cost_usd: Number(r.cost_usd),
      }))}
      canEdit={dossier.ownerId === userData.user?.id}
      initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined}
      initialOpen={t && t.length < 40 ? t : undefined}
    />
  );
}
