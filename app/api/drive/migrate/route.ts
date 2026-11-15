import { NextResponse } from "next/server";
import { requireDrive } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";
import { backupToDrive } from "@/lib/fileStore";

export const maxDuration = 300;

/** Copie de sauvegarde sur Google Drive des fichiers qui n'en ont pas encore (fichiers gardés dans l'application). */
export async function POST() {
  try {
    const { dossierId } = await requireOwner();
    await requireDrive(dossierId); // message clair si Drive n'est pas connecté
    const { saved, failed } = await backupToDrive(dossierId);
    return NextResponse.json({ moved: saved, failed });
  } catch (e) {
    return errorResponse(e);
  }
}
