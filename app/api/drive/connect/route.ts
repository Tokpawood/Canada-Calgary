import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, driveConfigured } from "@/lib/drive";
import { errorResponse, requireOwner } from "@/lib/driveRoute";

export async function GET(request: NextRequest) {
  try {
    await requireOwner();
    if (!driveConfigured()) return NextResponse.redirect(new URL("/compte?drive=non-configure#drive", request.url));
    const calendar = request.nextUrl.searchParams.get("calendar") === "1";
    const state = `${calendar ? "cal." : ""}${randomBytes(24).toString("base64url")}`;
    const res = NextResponse.redirect(authUrl(request.nextUrl.origin, state, calendar));
    res.cookies.set("drive_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/api/drive", maxAge: 600 });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
