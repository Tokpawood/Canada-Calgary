import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountBoard } from "@/components/compte/AccountBoard";

export default async function ComptePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return <AccountBoard email={data.user.email ?? ""} lastSignIn={data.user.last_sign_in_at ?? null} createdAt={data.user.created_at ?? null} />;
}
