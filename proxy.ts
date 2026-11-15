import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Chemins publics : la page elle-même ou ses sous-chemins (« /login » oui, « /loginX » non).
const PUBLIC_PATHS = ["/login", "/api/cron", "/manifest.json", "/sw.js", "/confidentialite", "/conditions", "/robots.txt"];
// Fichier de validation Google à la racine (google<jeton>.html).
const GOOGLE_VERIFICATION = /^\/google[\w-]*\.html$/;

function isPublicPath(path: string): boolean {
  if (path === "/" || GOOGLE_VERIFICATION.test(path)) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);

  if (!userData.user) {
    if (isPublic) return response;
    // Une route API appelée sans session répond en JSON, pas par une page de connexion.
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path !== "/mfa" && !isPublic) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      return NextResponse.redirect(new URL("/mfa", request.url));
    }
  }

  if (path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
