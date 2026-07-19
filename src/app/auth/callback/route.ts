import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback: Google redirects here with a `code`, which we exchange for a
 * Supabase session (cookies), then send the user into the app.
 */

/**
 * Resolve the post-login destination safely. `next` is attacker-controllable, so
 * only a same-origin relative path is allowed — anything resolving off-origin
 * (`//evil.com`, `https://evil.com`, `@evil.com`, …) falls back to /dashboard.
 * Closes an open-redirect / phishing vector.
 */
function safeNext(raw: string | null, origin: string): string {
  if (!raw) return "/dashboard";
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin) return url.pathname + url.search;
  } catch {
    /* malformed → default */
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fire a signup event only for brand-new users (their auth row was created
      // moments ago) so the funnel counts conversions, not repeat logins.
      // Analytics must never block auth, so this is best-effort.
      try {
        const { data } = await supabase.auth.getUser();
        const createdAt = data.user?.created_at;
        if (createdAt && Date.now() - Date.parse(createdAt) < 60_000) {
          await track("signup_completed");
        }
      } catch {
        /* ignore — analytics is non-critical */
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    // A NEW signup is rejected by the DB trigger once we're at the user cap.
    // Distinguish that (so the landing can say "we're full") from a generic
    // auth failure by asking whether signups are still open.
    const { data: open } = await supabase.rpc("signups_open");
    if (open === false) {
      return NextResponse.redirect(`${origin}/?full=1`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
