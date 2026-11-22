import { NextResponse } from "next/server";

/** Version en ligne de l'application (commit déployé), pour signaler une mise à jour aux pages déjà ouvertes. */
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
