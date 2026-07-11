/**
 * Site-wide constants. Configurable via env so they can differ per deployment
 * without code changes. `NEXT_PUBLIC_` = safe to read in the browser (these
 * values are shown publicly anyway).
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL;