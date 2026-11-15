import { NextResponse } from "next/server";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { sendToDossier } from "@/lib/push";

/** Envoie une notification d'essai à tous les appareils abonnés du titulaire. */
export async function POST() {
  try {
    const { dossierId } = await requireOwner();
    const r = await sendToDossier(dossierId, {
      title: "Notifications activées",
      body: "Vous recevrez ici les tâches de la formation, au bon moment de la journée.",
      url: "/formation#jour",
      tag: "test",
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
