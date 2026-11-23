import { NextResponse, after, type NextRequest } from "next/server";
import { setCalendarEnabled, syncCalendar } from "@/lib/calendar";
import { CALENDAR_SCOPE, DRIVE_SCOPE, accountEmail, encryptToken, ensureRootFolder, exchangeCode, getConnection, saveConnection } from "@/lib/drive";
import { requireOwner } from "@/lib/driveRoute";

export const maxDuration = 300;

function back(request: NextRequest, status: string) {
  const cal = request.cookies.get("drive_oauth_state")?.value.startsWith("cal.");
  const res = NextResponse.redirect(new URL(cal ? `/compte?calendrier=${status}#calendrier` : `/compte?drive=${status}#drive`, request.url));
  res.cookies.delete({ name: "drive_oauth_state", path: "/api/drive" });
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const expected = request.cookies.get("drive_oauth_state")?.value;
  if (params.get("error")) return back(request, "refuse");
  if (!state || !expected || state !== expected) return back(request, "etat-invalide");
  const code = params.get("code");
  if (!code) return back(request, "erreur");

  try {
    const { dossierId } = await requireOwner();
    const { refreshToken, accessToken, scopes } = await exchangeCode(request.nextUrl.origin, code);
    // Case Drive décochée sur l'écran Google : la connexion en place est gardée telle quelle.
    if (!scopes.includes(DRIVE_SCOPE)) return back(request, "refuse");
    const previous = await getConnection(dossierId);
    const rootFolderId = await ensureRootFolder(accessToken, previous?.rootFolderId ?? null);
    await saveConnection(dossierId, {
      refresh_token_enc: encryptToken(refreshToken),
      account_email: await accountEmail(accessToken),
      root_folder_id: rootFolderId,
      folders: rootFolderId === previous?.rootFolderId ? previous.folders : {},
      connected_at: new Date().toISOString(),
    });
    if (state.startsWith("cal.")) {
      if (!scopes.includes(CALENDAR_SCOPE)) return back(request, "refuse");
      await setCalendarEnabled(dossierId, true);
      after(() => syncCalendar(dossierId).catch((e) => console.error("[calendrier]", e instanceof Error ? e.message : e)));
    }
    return back(request, "connecte");
  } catch (e) {
    console.error("[drive callback]", e);
    return back(request, "erreur");
  }
}
