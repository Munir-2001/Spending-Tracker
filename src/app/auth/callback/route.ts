import { NextResponse } from "next/server";
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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
