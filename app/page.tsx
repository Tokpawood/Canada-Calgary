import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: dossier } = await supabase.from("dossier").select("id").maybeSingle();
  redirect(dossier ? "/parcours" : "/import");
}
