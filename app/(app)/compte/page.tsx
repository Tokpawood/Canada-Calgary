import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountBoard } from "@/components/compte/AccountBoard";
import { DriveCard, type DriveStatus } from "@/components/compte/DriveCard";
import { CalendarCard } from "@/components/compte/CalendarCard";
import { calendarStatus, type CalendarStatus } from "@/lib/calendar";
import { driveConfigured, folderLink, getConnection } from "@/lib/drive";
import { getAccount } from "@/lib/account";
import { AccountIdentityCard } from "@/components/compte/AccountIdentityCard";
import { NotificationsCard } from "@/components/compte/NotificationsCard";
import { DEFAULT_SETTINGS, cleanTimes, type NotifySettings } from "@/lib/notifyPlan";

export default async function ComptePage({ searchParams }: { searchParams: Promise<{ drive?: string; calendrier?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: dossier } = await supabase.from("dossier").select("id").eq("owner_id", data.user.id).maybeSingle();
  let drive: DriveStatus | null = null;
  let calendar: CalendarStatus | null = null;
  if (dossier) {
    const conn = await getConnection(dossier.id as string).catch(() => null);
    const { count } = await supabase.from("file").select("id", { count: "exact", head: true }).eq("dossier_id", dossier.id).eq("provider", "supabase").is("drive_file_id", null).is("replaced_at", null);
    calendar = await calendarStatus(dossier.id as string);
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

  let notify: { settings: NotifySettings; devices: number } | null = null;
  if (dossier) {
    const [{ data: row }, { count }] = await Promise.all([
      supabase.from("notification_settings").select("enabled,times,include_steps").eq("dossier_id", dossier.id).maybeSingle(),
      supabase.from("push_subscription").select("id", { count: "exact", head: true }).eq("dossier_id", dossier.id),
    ]);
    notify = {
      settings: row ? { enabled: Boolean(row.enabled), times: cleanTimes(row.times), includeSteps: Boolean(row.include_steps) } : DEFAULT_SETTINGS,
      devices: count ?? 0,
    };
  }

  return (
    <AccountBoard email={data.user.email ?? ""} account={account} lastSignIn={data.user.last_sign_in_at ?? null} createdAt={data.user.created_at ?? null}>
      <AccountIdentityCard account={account} />
      {dossier && notify && <NotificationsCard dossierId={dossier.id as string} initial={notify.settings} devices={notify.devices} />}
      {drive && calendar && <CalendarCard initial={calendar} configured={drive.configured} connected={drive.connected} notice={(await searchParams).calendrier ?? null} />}
      {drive && <DriveCard status={drive} />}
    </AccountBoard>
  );
}
