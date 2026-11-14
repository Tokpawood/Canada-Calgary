import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountBoard } from "@/components/compte/AccountBoard";
import { DriveCard, type DriveStatus } from "@/components/compte/DriveCard";
import { driveConfigured, folderLink, getConnection } from "@/lib/drive";
import { getAccount } from "@/lib/account";
import { AccountIdentityCard } from "@/components/compte/AccountIdentityCard";

export default async function ComptePage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: dossier } = await supabase.from("dossier").select("id").eq("owner_id", data.user.id).maybeSingle();
  let drive: DriveStatus | null = null;
  if (dossier) {
    const conn = await getConnection(dossier.id as string).catch(() => null);
    const { count } = await supabase.from("file").select("id", { count: "exact", head: true }).eq("dossier_id", dossier.id).eq("provider", "supabase");
    drive = {
      configured: driveConfigured(),
      connected: Boolean(conn?.refreshToken),
      accountEmail: conn?.accountEmail ?? null,
      folderUrl: folderLink(conn?.rootFolderId ?? null),
      pendingMigration: count ?? 0,
      notice: (await searchParams).drive ?? null,
    };
  }

  const account = await getAccount(supabase, data.user, (dossier?.id as string | undefined) ?? null);

  return (
    <AccountBoard email={data.user.email ?? ""} account={account} lastSignIn={data.user.last_sign_in_at ?? null} createdAt={data.user.created_at ?? null}>
      <AccountIdentityCard account={account} />
      {drive && <DriveCard status={drive} />}
    </AccountBoard>
  );
}
