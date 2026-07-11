import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session on every request and guards routes:
 * unauthenticated users are sent to the landing (/), signed-in users to /dashboard.
 * In local mode (no Supabase keys) auth is skipped entirely.
 */
export async function updateSession(request: NextRequest) {
  if (!SUPABASE_CONFIGURED) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // Supabase unreachable (e.g. placeholder env) — treat as logged out.
  }

  const path = request.nextUrl.pathname;
  // Publicly reachable without signing in: the landing (which hosts the Google
  // OAuth button), the OAuth callback, and legal pages.
  const isPublicRoute =
    path === "/" || path.startsWith("/auth") || path.startsWith("/privacy");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/"; // send them to the landing to sign in
    return NextResponse.redirect(url);
  }
  // Signed-in users skip the landing and go straight to the app.
  if (user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
