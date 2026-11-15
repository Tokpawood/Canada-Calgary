import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDossierForUser } from "@/lib/queries";
import { FormationBoard } from "@/components/formation/FormationBoard";
import type { Lang, TrainingScore } from "@/lib/formation";

export const metadata = { title: "Formation TCF · IELTS — Projet Canada Calgary" };

export default async function FormationPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const dossier = await getDossierForUser(supabase);
  if (!dossier) redirect("/import");

  const [{ data: checks }, { data: scoreRows }] = await Promise.all([
    supabase.from("training_check").select("item_key").eq("dossier_id", dossier.id),
    supabase.from("training_score").select("*").eq("dossier_id", dossier.id).order("taken_on", { ascending: true }),
  ]);

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
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });

  return (
    <FormationBoard
      dossierId={dossier.id}
      today={today}
      initialDone={(checks ?? []).map((c) => c.item_key as string)}
      initialScores={scores}
      canEdit={dossier.ownerId === userData.user?.id}
    />
  );
}
