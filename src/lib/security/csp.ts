/**
 * Builds the Content-Security-Policy string for a given per-request nonce.
 *
 * `'strict-dynamic'` + a nonce means only scripts we explicitly trust (Next's own
 * bundles, which Next tags with the nonce) can run, and anything they load
 * inherits that trust — inline/injected attacker scripts cannot. Styles are
 * nonce-gated too. `connect-src` allows same-origin (server actions) plus the
 * Supabase origin, since the browser Supabase client talks to it directly during
 * auth. The external price feeds (gold/crypto/FX) are fetched server-side only,
 * so they need no browser allowance.
 */
export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const directives = [
    `default-src 'self'`,
    // React uses eval() in dev for better stack traces; never in prod.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Third-party libs inject runtime styles without a nonce; allow inline in dev
    // so it isn't noisy, and rely on report-only in prod to surface them.
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join("; ");
}
