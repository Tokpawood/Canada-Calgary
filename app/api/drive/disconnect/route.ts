import { NextResponse } from "next/server";
import { getConnection, revokeToken, saveConnection } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";

/** Révoque l'accès Google. Les fichiers restent sur Drive ; le dossier est réutilisé à la reconnexion. */
export async function POST() {
  try {
    const { dossierId } = await requireOwner();
    const conn = await getConnection(dossierId);
    if (conn?.refreshToken) await revokeToken(conn.refreshToken);
    if (conn) await saveConnection(dossierId, { refresh_token_enc: null, connected_at: null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
