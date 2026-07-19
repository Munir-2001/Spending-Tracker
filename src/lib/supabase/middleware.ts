import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session on every request and guards routes:
 * unauthenticated users are sent to the landing (/), signed-in users to /dashboard.
 * In local mode (no Supabase keys) auth is skipped entirely.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers
) {
  // When the proxy passes nonce/CSP request headers, forward them to the render
  // so Next can attach the nonce to its scripts.
  const nextArg = requestHeaders
    ? { request: { headers: requestHeaders } }
    : { request };

  if (!SUPABASE_CONFIGURED) return NextResponse.next(nextArg);

  let response = NextResponse.next(nextArg);

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
          response = NextResponse.next(nextArg);
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
  // OAuth button), the OAuth callback, legal pages, and the SEO / social /
  // metadata assets — those are fetched by unauthenticated crawlers and social
  // scrapers, so they must never be redirected to the landing.
  const isPublicRoute =
    path === "/" ||
    path.startsWith("/auth") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/opengraph-image") ||
    path.startsWith("/twitter-image") ||
    path.startsWith("/icon") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/llms.txt" ||
    path === "/manifest.webmanifest";

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
