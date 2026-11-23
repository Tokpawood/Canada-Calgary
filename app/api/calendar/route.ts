import { NextResponse, after } from "next/server";
import { calendarStatus, setCalendarEnabled, syncCalendar } from "@/lib/calendar";
import { requireDrive } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";

export const maxDuration = 300;

export async function GET() {
  try {
    const { dossierId } = await requireOwner();
    return NextResponse.json(await calendarStatus(dossierId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Lance la mise à jour après la réponse (le premier envoi dure quelques minutes). */
export async function POST() {
  try {
    const { dossierId } = await requireOwner();
    await requireDrive(dossierId);
    after(() => syncCalendar(dossierId).catch((e) => console.error("[calendrier]", e instanceof Error ? e.message : e)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Arrête la synchronisation ; le calendrier et son contenu restent dans Google. */
export async function DELETE() {
  try {
    const { dossierId } = await requireOwner();
    await setCalendarEnabled(dossierId, false);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
