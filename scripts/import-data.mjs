/**
 * One-time, best-effort importer: pushes your local data/*.json into Supabase
 * for a specific user. Run LOCALLY (uses the service-role key, which bypasses
 * RLS). Your dataset is small, so re-entering by hand is also a fine option.
 *
 * Usage:
 *   1. Sign in to the deployed app once (this creates your user + default
 *      categories via the signup trigger).
 *   2. Get your user id from Supabase → Authentication → Users.
 *   3. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *   4. node scripts/import-data.mjs <your-user-id>
 *
 * Re-running is NOT idempotent for accounts/transactions — run once on a clean
 * account, or clear those tables first.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// --- load env from .env.local ---
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2];

if (!url || !key) throw new Error("Missing Supabase URL / service-role key in .env.local");
if (!userId) throw new Error("Pass your user id: node scripts/import-data.mjs <user-id>");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const read = (f) => JSON.parse(readFileSync(`data/${f}.json`, "utf8"));

const accounts = read("accounts");
const categories = read("categories");
const transactions = read("transactions");
const lines = read("transaction_lines");
const budgets = read("budgets");

// 1) Map local categories → the user's categories (by name), inserting any missing.
const { data: existingCats } = await supabase
  .from("categories")
  .select("id,name")
  .eq("user_id", userId);
const byName = new Map((existingCats ?? []).map((c) => [c.name.toLowerCase(), c.id]));
const catIdMap = new Map(); // localId -> dbId

for (const c of categories) {
  const hit = byName.get(c.name.toLowerCase());
  if (hit) {
    catIdMap.set(c.id, hit);
  } else {
    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: c.name, kind: c.kind, color: c.color })
      .select("id")
      .single();
    if (error) throw error;
    catIdMap.set(c.id, data.id);
    byName.set(c.name.toLowerCase(), data.id);
  }
}
const mapCat = (id) => (id ? catIdMap.get(id) ?? null : null);

// 2) Accounts (keep their uuids; just attach the user).
if (accounts.length) {
  const { error } = await supabase
    .from("accounts")
    .insert(accounts.map((a) => ({ ...a, user_id: userId })));
  if (error) throw error;
}

// 3) Transactions (remap category_id).
if (transactions.length) {
  const { error } = await supabase.from("transactions").insert(
    transactions.map((t) => ({ ...t, user_id: userId, category_id: mapCat(t.category_id) }))
  );
  if (error) throw error;
}

// 4) Line items (remap category_id; keep transaction_id).
if (lines.length) {
  const { error } = await supabase
    .from("transaction_lines")
    .insert(lines.map((l) => ({ ...l, category_id: mapCat(l.category_id) })));
  if (error) throw error;
}

// 5) Budgets (remap category_id).
if (budgets.length) {
  const { error } = await supabase
    .from("budgets")
    .insert(budgets.map((b) => ({ ...b, user_id: userId, category_id: mapCat(b.category_id) })));
  if (error) throw error;
}

console.log(
  `Imported: ${accounts.length} accounts, ${transactions.length} transactions, ${lines.length} line items, ${budgets.length} budgets.`
);
