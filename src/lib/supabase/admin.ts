import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. UNLIKE the request-scoped client in
 * `server.ts`, this bypasses Row-Level Security — it authenticates with the
 * service key, not a user session. Use it ONLY from trusted server-side jobs
 * that legitimately operate across users (e.g. the net-worth snapshot cron),
 * never in a request handler that returns data to a browser.
 *
 * Returns null when the service key isn't configured (local demo / preview) so
 * callers can no-op cleanly instead of throwing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("placeholder")) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
