import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/LandingPage";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  // Visiteur non connecté : page d'accueil publique (présentation, sans aucune donnée personnelle).
  if (!userData.user) return <LandingPage />;
  const { data: dossier } = await supabase.from("dossier").select("id").maybeSingle();
  redirect(dossier ? "/parcours" : "/import");
}
