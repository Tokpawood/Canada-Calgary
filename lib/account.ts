import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Identité affichée du titulaire du compte (barre latérale, Compte et sécurité). */
export interface Account {
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  email: string;
  avatarUrl: string | null;
  avatarPath: string | null;
}

function cap(s: string): string {
  return s
    .toLowerCase()
    .split(/([\s-])/)
    .map((p) => (p.length > 0 && !/[\s-]/.test(p) ? p[0].toUpperCase() + p.slice(1) : p))
    .join("");
}

/** Prénom et nom : ceux du compte, sinon ceux de l'identité du dossier, sinon le courriel. */
export async function getAccount(supabase: SupabaseClient, user: User, dossierId: string | null): Promise<Account> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  let firstName = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  let lastName = typeof meta.last_name === "string" ? meta.last_name.trim() : "";

  if (!firstName && !lastName && dossierId) {
    const { data } = await supabase.from("identity").select("prenoms,nom").eq("dossier_id", dossierId).maybeSingle();
    firstName = cap(String(data?.prenoms ?? "").split(/\s+/)[0] ?? "");
    lastName = cap(String(data?.nom ?? ""));
  }

  const email = user.email ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;
  const initials = (firstName || lastName ? `${firstName[0] ?? ""}${lastName[0] ?? ""}` : email[0] ?? "?").toUpperCase();

  const avatarPath = typeof meta.avatar_path === "string" && meta.avatar_path ? meta.avatar_path : null;
  let avatarUrl: string | null = null;
  if (avatarPath) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60 * 6);
    avatarUrl = data?.signedUrl ?? null;
  }

  return { firstName, lastName, fullName, initials, email, avatarUrl, avatarPath };
}
