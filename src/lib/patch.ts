/**
 * Helpers for non-destructive updates. Both data backends apply a *partial*
 * UPDATE (Supabase `.update(patch)` sets only provided keys; the file store
 * spreads `{...row, ...patch}`), so a key omitted from the patch leaves the
 * stored value untouched.
 *
 * `keepIfEmpty` drops keys whose value is null/undefined/"" — so an edit only
 * changes fields it actually carries a value for, and a blank form field can
 * never silently wipe saved data (the bug that nulled account numbers).
 *
 * Use ONLY for OPTIONAL text/PII columns. Never route numbers, booleans, or
 * fields whose null is a real choice (0 / false / "cleared" / "uncategorized")
 * through this — those must be written explicitly in the base patch.
 */
export function keepIfEmpty<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const out: Partial<T> = {};
  for (const k in obj) {
    const val = obj[k];
    if (val === null || val === undefined || val === "") continue;
    out[k] = val;
  }
  return out;
}
