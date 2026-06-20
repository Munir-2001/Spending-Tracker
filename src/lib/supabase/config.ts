/**
 * Whether real Supabase credentials are present. When false the app runs in
 * "local mode": file-based storage + no auth, so it works on localhost with no
 * setup. Set real keys in .env.local (or Vercel) to switch to Supabase.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_CONFIGURED =
  url.length > 0 && !url.includes("placeholder");
