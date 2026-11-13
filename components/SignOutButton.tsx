"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">
      Se déconnecter
    </button>
  );
}
