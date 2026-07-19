import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/security/csp";

// Next.js 16 "proxy" convention (replaces the old middleware file). Refreshes the
// Supabase session, guards routes, and attaches a per-request CSP nonce.
export async function proxy(request: NextRequest) {
  // Fresh, unpredictable nonce per request (base64). btoa/crypto are Edge-safe.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Next reads the nonce from the CSP *request* header and tags its own scripts
  // with it; x-nonce lets Server Components read it too.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = await updateSession(request, requestHeaders);

  // REPORT-ONLY for now: the nonce is applied to scripts and violations are
  // reported to the console, but nothing is blocked. Once the console is clean
  // (see notes), switch this to "content-security-policy" to enforce.
  response.headers.set("content-security-policy-report-only", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and image files. Skip prefetches
    // so a prefetched route doesn't burn a nonce it won't use.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
