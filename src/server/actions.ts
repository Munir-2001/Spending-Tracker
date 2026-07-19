"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import * as db from "@/server/db";
import { enc, dec, hashToken } from "@/server/crypto";
import * as v from "@/server/validation";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import {
  DEMO_USER_ID,
  type AccountRow,
  type AssetRow,
  type AssetLotRow,
  type NewAssetLotInput,
  type BudgetRow,
  type CategoryRow,
  type GoalRow,
  type NewAccountInput,
  type NewAssetInput,
  type NewCategoryInput,
  type NewGoalInput,
  type NewRecurringInput,
  type NewTransactionInput,
  type RecurringRow,
  type RepaymentInput,
  type TransferInput,
  type TransactionLineRow,
  type TransactionRow,
  type UserSettingsRow,
} from "@/lib/schema";
import type {
  Account,
  Asset,
  AssetLot,
  Budget,
  Category,
  Goal,
  RecurringRule,
  Transaction,
  TransactionItem,
} from "@/lib/data";
import { DEFAULT_BASE_CURRENCY, DEFAULT_RATES, toMinorUnits } from "@/lib/currency";
import { goldValueMajor, gramsOf, GRAMS_PER_UNIT } from "@/lib/gold";
import { getUsdGoldQuote } from "@/server/prices";

/** The current authenticated user's id (or the demo user in local mode). */
async function getUserId(): Promise<string> {
  if (!SUPABASE_CONFIGURED) return DEMO_USER_ID;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/** Name + email of the signed-in user, for the sidebar. */
export async function getCurrentUser(): Promise<{
  name: string;
  email: string;
} | null> {
  if (!SUPABASE_CONFIGURED) return { name: "You", email: "Local demo" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    name:
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "You",
    email: user.email ?? "",
  };
}

export async function signOut() {
  if (!SUPABASE_CONFIGURED) return redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/"); // back to the landing
}

// ── Row → UI mappers ────────────────────────────────────────────────────────
function accountToUi(r: AccountRow): Account {
  return {
    id: r.id,
    name: dec(r.name) ?? "",
    institution: dec(r.institution),
    accountNumber: dec(r.account_number),
    type: r.type === "liability" ? "liability" : "asset",
    subtype: r.subtype,
    currency: r.currency,
    parentId: r.parent_id,
    isGroup: r.is_group,
    openingBalance: r.opening_balance,
  };
}

function categoryToUi(r: CategoryRow): Category {
  return {
    id: r.id,
    label: r.name,
    kind: r.kind,
    tint: r.color ?? "var(--muted-foreground)",
    parentId: r.parent_id ?? null,
  };
}

function lineToUi(r: TransactionLineRow): TransactionItem {
  return {
    id: r.id,
    categoryId: r.category_id ?? "",
    description: dec(r.description) ?? "",
    amount: r.amount,
  };
}

function transactionToUi(
  r: TransactionRow,
  items?: TransactionItem[]
): Transaction {
  const reimburseAmount = r.reimburse_amount ?? 0;
  return {
    id: r.id,
    date: r.date,
    merchant: dec(r.description) ?? "",
    categoryId: r.category_id ?? "",
    accountId: r.account_id,
    amount: r.amount,
    currency: r.currency,
    pending: r.status === "pending",
    items: items && items.length ? items : undefined,
    reimbursement:
      reimburseAmount > 0 || r.reimburse_person
        ? {
            person: dec(r.reimburse_person) ?? "",
            amount: reimburseAmount,
            note: dec(r.reimburse_note) ?? "",
            settled: r.reimburse_settled ?? false,
            settledAt: r.reimburse_settled_at ?? null,
          }
        : undefined,
    isReimbursement: r.is_reimbursement ?? false,
    isTransfer: r.is_transfer ?? false,
    settlesId: r.settles_id ?? undefined,
    notes: dec(r.notes) ?? undefined,
  };
}

// Default reimbursement/transfer columns for new rows.
const noReimburse = {
  reimburse_person: null,
  reimburse_amount: 0,
  reimburse_note: null,
  reimburse_settled: false,
  reimburse_settled_at: null,
  is_reimbursement: false,
  is_transfer: false,
  settles_id: null,
} as const;

const byDateDesc = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

// ── Reads ───────────────────────────────────────────────────────────────────
export async function listAccounts(): Promise<Account[]> {
  const rows = await db.selectAll("accounts");
  return rows.map(accountToUi);
}

export async function listCategories(): Promise<Category[]> {
  const rows = await db.selectAll("categories");
  return rows.map(categoryToUi);
}

// ── Assets ──────────────────────────────────────────────────────────────────
function assetToUi(r: AssetRow): Asset {
  return {
    id: r.id,
    name: dec(r.name) ?? "",
    type: r.type,
    value: r.value,
    currency: r.currency,
    note: dec(r.note),
    symbol: r.symbol ?? null,
    quantity: r.quantity ?? null,
    unit: r.unit ?? null,
    karat: r.karat ?? null,
    costBasis: r.cost_basis ?? null,
  };
}

// Market-priced (gold) columns pulled from an input; null for manual assets.
function marketFields(input: NewAssetInput) {
  return {
    symbol: input.symbol ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    karat: input.karat ?? null,
    cost_basis: input.costBasis ?? null,
  };
}

function revalidateAssetViews() {
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/accounts");
  revalidatePath("/reports");
}

export async function listAssets(): Promise<Asset[]> {
  const rows = await db.selectAll("assets");
  return rows.map(assetToUi);
}

export async function createAsset(raw: NewAssetInput): Promise<Asset> {
  const input = v.assetInput.parse(raw) as NewAssetInput;
  const userId = await getUserId();
  const now = new Date().toISOString();
  const row: AssetRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    name: enc(input.name)!,
    type: input.type,
    value: input.value,
    currency: input.currency,
    note: enc(input.note),
    ...marketFields(input),
    created_at: now,
    updated_at: now,
  };
  await db.insert("assets", row);
  // For a gold holding, record the opening purchase as its first lot so the
  // asset never exists without a lot backing its cost basis.
  if (input.symbol === "XAU" && input.firstLot && input.quantity && input.unit) {
    const { rates } = await getSettings();
    const fl = input.firstLot;
    const lot: AssetLotRow = {
      id: randomUUID(),
      user_id: userId,
      org_id: null,
      asset_id: row.id,
      date: fl.date,
      quantity: input.quantity,
      unit: input.unit,
      karat: input.karat ?? null,
      gold_cost: fl.goldCost,
      commission: fl.commission,
      tax: fl.tax,
      cost_basis: fl.goldCost + fl.commission + fl.tax,
      currency: input.currency,
      purchase_fx_rate: rates[input.currency] ?? null,
      note: null,
      created_at: now,
      updated_at: now,
    };
    await db.insert("asset_lots", lot);
  }
  revalidateAssetViews();
  return assetToUi(row);
}

export async function updateAsset(
  id: string,
  raw: NewAssetInput
): Promise<Asset | null> {
  const input = v.assetInput.parse(raw) as NewAssetInput;
  v.idInput.parse(id);
  const updated = await db.update("assets", id, {
    name: enc(input.name)!,
    type: input.type,
    value: input.value,
    currency: input.currency,
    note: enc(input.note),
    ...marketFields(input),
    updated_at: new Date().toISOString(),
  });
  revalidateAssetViews();
  return updated ? assetToUi(updated) : null;
}

export async function deleteAsset(id: string): Promise<void> {
  v.idInput.parse(id);
  await db.remove("assets", id);
  revalidateAssetViews();
}

/**
 * Re-price every market-priced (gold) asset from the live spot and persist the
 * new market value. We fetch the international XAU/USD spot once and convert
 * into each holding's own currency using the user's FX rates — so gold is
 * benchmarked in USD and the user controls the conversion. Values each purchase
 * lot individually so mixed-karat holdings price correctly.
 *
 * Returns the refreshed assets, when they were priced, whether a live fetch
 * happened (false = no API key / offline, values are last-known), and the raw
 * USD per-gram price so the client can show exact USD P/L without a round-trip.
 * Safe to call with no gold assets.
 */
export async function refreshGoldPrices(force = false): Promise<{
  assets: Asset[];
  pricedAt: string | null;
  live: boolean;
  usdGram: number | null;
}> {
  const rows = await db.selectAll("assets");
  const gold = rows.filter(
    (r) => r.symbol === "XAU" && r.quantity && r.quantity > 0 && r.unit
  );
  if (gold.length === 0)
    return { assets: rows.map(assetToUi), pricedAt: null, live: false, usdGram: null };

  const usd = await getUsdGoldQuote(force);
  // No key / offline / bad response → keep last-known values.
  if (!usd)
    return { assets: rows.map(assetToUi), pricedAt: null, live: false, usdGram: null };

  const { rates } = await getSettings();
  const usdRate = rates.USD ?? 1;

  // Load all lots once, grouped by asset, so mixed-karat holdings value right.
  const allLots = await db.selectAll("asset_lots");
  const lotsByAsset = new Map<string, AssetLotRow[]>();
  for (const l of allLots) {
    const arr = lotsByAsset.get(l.asset_id) ?? [];
    arr.push(l);
    lotsByAsset.set(l.asset_id, arr);
  }

  const now = new Date().toISOString();
  for (const r of gold) {
    // USD spot → per-gram 24k price in the asset's own currency (via the
    // numeraire, same math as convertWithRates applied to a per-gram amount).
    const gramPrice = (usd.gram24k * usdRate) / (rates[r.currency] ?? 1);
    const lots = lotsByAsset.get(r.id) ?? [];
    let major = 0;
    if (lots.length > 0) {
      for (const l of lots) major += goldValueMajor(l.quantity, l.unit, l.karat, gramPrice);
    } else {
      major = goldValueMajor(r.quantity!, r.unit!, r.karat, gramPrice);
    }
    await db.update("assets", r.id, { value: toMinorUnits(major, r.currency), updated_at: now });
  }

  // Fetched within the last minute ⇒ this call hit the API (not just cache).
  const live = Date.now() - Date.parse(usd.at) < 60_000;
  revalidateAssetViews();
  const updated = await db.selectAll("assets");
  return { assets: updated.map(assetToUi), pricedAt: usd.at, live, usdGram: usd.gram24k };
}

// ── Asset lots (per-purchase gold) ───────────────────────────────────────────
function lotToUi(r: AssetLotRow): AssetLot {
  return {
    id: r.id,
    assetId: r.asset_id,
    date: r.date,
    quantity: r.quantity,
    unit: r.unit,
    karat: r.karat ?? null,
    goldCost: r.gold_cost,
    commission: r.commission,
    tax: r.tax,
    costBasis: r.cost_basis,
    currency: r.currency,
    purchaseFxRate: r.purchase_fx_rate ?? null,
    note: dec(r.note),
  };
}

/**
 * Local (file) mode has no SQL migration runner, so backfill a single lot for
 * any pre-existing gold asset that has none. Idempotent; no-op in Supabase mode
 * (the 0005 migration handles that there).
 */
async function ensureLotsForGold(): Promise<void> {
  if (SUPABASE_CONFIGURED) return;
  const assets = await db.selectAll("assets");
  const gold = assets.filter(
    (a) => a.symbol === "XAU" && a.quantity && a.quantity > 0 && a.unit
  );
  if (gold.length === 0) return;
  const lots = await db.selectAll("asset_lots");
  const haveLot = new Set(lots.map((l) => l.asset_id));
  const userId = await getUserId();
  const now = new Date().toISOString();
  for (const a of gold) {
    if (haveLot.has(a.id)) continue;
    const lot: AssetLotRow = {
      id: randomUUID(),
      user_id: userId,
      org_id: null,
      asset_id: a.id,
      date: (a.created_at ?? now).slice(0, 10),
      quantity: a.quantity!,
      unit: a.unit!,
      karat: a.karat ?? null,
      gold_cost: a.cost_basis ?? 0,
      commission: 0,
      tax: 0,
      cost_basis: a.cost_basis ?? 0,
      currency: a.currency,
      purchase_fx_rate: null,
      note: null,
      created_at: now,
      updated_at: now,
    };
    await db.insert("asset_lots", lot);
  }
}

export async function listAllLots(): Promise<AssetLot[]> {
  await ensureLotsForGold();
  const rows = await db.selectAll("asset_lots");
  return rows.map(lotToUi);
}

export async function listLots(assetId: string): Promise<AssetLot[]> {
  v.idInput.parse(assetId);
  const rows = await db.selectWhere("asset_lots", { asset_id: assetId });
  return rows.map(lotToUi);
}

/**
 * Recompute a gold asset's aggregate quantity + cost basis from its lots. Sums
 * quantity in grams (never across raw units) and stores it back as tola; carries
 * the most-recent lot's karat as representative. `value` is set to cost basis as
 * a provisional floor — the live-price refresh overwrites it.
 */
async function recomputeAssetFromLots(assetId: string): Promise<void> {
  const lots = await db.selectWhere("asset_lots", { asset_id: assetId });
  const now = new Date().toISOString();
  if (lots.length === 0) {
    await db.update("assets", assetId, { quantity: 0, cost_basis: 0, updated_at: now });
    return;
  }
  const totalGrams = lots.reduce((s, l) => s + gramsOf(l.quantity, l.unit), 0);
  const costBasis = lots.reduce((s, l) => s + l.cost_basis, 0);
  const latest = [...lots].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.created_at < b.created_at ? 1 : -1
  )[0];
  await db.update("assets", assetId, {
    quantity: totalGrams / GRAMS_PER_UNIT.tola,
    unit: "tola",
    karat: latest.karat ?? null,
    cost_basis: costBasis,
    value: costBasis,
    updated_at: now,
  });
}

export async function createAssetLot(raw: NewAssetLotInput): Promise<AssetLot> {
  const input = v.assetLotInput.parse(raw) as NewAssetLotInput;
  const userId = await getUserId();
  // Confirm the parent asset is the caller's own (RLS-scoped read) so a lot
  // can't be attached to another user's asset id.
  const parent = await db.findById("assets", input.assetId);
  if (!parent) throw new Error("Asset not found");
  const now = new Date().toISOString();
  const { rates } = await getSettings();
  const row: AssetLotRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    asset_id: input.assetId,
    date: input.date,
    quantity: input.quantity,
    unit: input.unit,
    karat: input.karat,
    gold_cost: input.goldCost,
    commission: input.commission,
    tax: input.tax,
    cost_basis: input.goldCost + input.commission + input.tax,
    currency: input.currency,
    // Pin the FX rate at purchase so USD P/L isolates gold movement, not PKR drift.
    purchase_fx_rate: rates[input.currency] ?? null,
    note: enc(input.note ?? null),
    created_at: now,
    updated_at: now,
  };
  await db.insert("asset_lots", row);
  await recomputeAssetFromLots(input.assetId);
  revalidateAssetViews();
  return lotToUi(row);
}

export async function updateAssetLot(
  id: string,
  raw: NewAssetLotInput
): Promise<AssetLot | null> {
  const input = v.assetLotInput.parse(raw) as NewAssetLotInput;
  v.idInput.parse(id);
  const updated = await db.update("asset_lots", id, {
    date: input.date,
    quantity: input.quantity,
    unit: input.unit,
    karat: input.karat,
    gold_cost: input.goldCost,
    commission: input.commission,
    tax: input.tax,
    cost_basis: input.goldCost + input.commission + input.tax,
    currency: input.currency,
    note: enc(input.note ?? null),
    updated_at: new Date().toISOString(),
  });
  if (updated) await recomputeAssetFromLots(updated.asset_id);
  revalidateAssetViews();
  return updated ? lotToUi(updated) : null;
}

export async function deleteAssetLot(id: string): Promise<void> {
  v.idInput.parse(id);
  const existing = await db.findById("asset_lots", id);
  await db.remove("asset_lots", id);
  if (existing) await recomputeAssetFromLots(existing.asset_id);
  revalidateAssetViews();
}

function revalidateCategoryViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/reports");
  revalidatePath("/ledger");
  revalidatePath("/settings");
}

export async function createCategory(raw: NewCategoryInput): Promise<Category> {
  const input = v.categoryInput.parse(raw) as NewCategoryInput;
  const userId = await getUserId();
  const row: CategoryRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    name: input.name,
    kind: input.kind,
    color: input.color,
    parent_id: input.parentId,
    created_at: new Date().toISOString(),
  };
  await db.insert("categories", row);
  revalidateCategoryViews();
  return categoryToUi(row);
}

export async function updateCategory(
  id: string,
  raw: NewCategoryInput
): Promise<Category | null> {
  const input = v.categoryInput.parse(raw) as NewCategoryInput;
  v.idInput.parse(id);
  const updated = await db.update("categories", id, {
    name: input.name,
    kind: input.kind,
    color: input.color,
    parent_id: input.parentId,
  });
  revalidateCategoryViews();
  return updated ? categoryToUi(updated) : null;
}

/**
 * Delete a category. Anything referencing it is made "uncategorized" rather
 * than deleted: transactions + line items get category_id = null, and any
 * budget for the category is removed.
 */
export async function deleteCategory(id: string): Promise<void> {
  v.idInput.parse(id);
  const txns = (
    await db.selectAll("transactions")
  ).filter((t) => t.category_id === id);
  for (const t of txns) await db.update("transactions", t.id, { category_id: null });

  const lines = (await db.selectAll("transaction_lines")).filter(
    (l) => l.category_id === id
  );
  for (const l of lines) await db.update("transaction_lines", l.id, { category_id: null });

  const budgets = await db.selectWhere("budgets", { category_id: id });
  for (const b of budgets) await db.remove("budgets", b.id);

  // Promote any sub-categories to top-level rather than orphaning them.
  const children = await db.selectWhere("categories", { parent_id: id });
  for (const c of children) await db.update("categories", c.id, { parent_id: null });

  await db.remove("categories", id);
  revalidateCategoryViews();
}

export async function listTransactions(): Promise<Transaction[]> {
  const [rows, lines] = await Promise.all([
    db.selectAll("transactions"),
    db.selectAll("transaction_lines"),
  ]);
  const linesByTxn = new Map<string, TransactionItem[]>();
  for (const l of lines) {
    const list = linesByTxn.get(l.transaction_id) ?? [];
    list.push(lineToUi(l));
    linesByTxn.set(l.transaction_id, list);
  }
  return rows
    .map((r) => transactionToUi(r, linesByTxn.get(r.id)))
    .sort(byDateDesc);
}

// ── Writes ──────────────────────────────────────────────────────────────────
export async function createAccount(raw: NewAccountInput): Promise<Account> {
  const input = v.accountInput.parse(raw) as NewAccountInput;
  const userId = await getUserId();
  const now = new Date().toISOString();
  const row: AccountRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    parent_id: input.parentId,
    is_group: input.isGroup,
    code: null,
    name: enc(input.name)!,
    type: input.type,
    subtype: input.isGroup ? null : input.subtype,
    normal_balance: input.type === "asset" ? "debit" : "credit",
    institution: enc(input.institution),
    mask: null,
    account_number: input.isGroup ? null : enc(input.accountNumber),
    currency: input.currency,
    opening_balance: input.isGroup ? 0 : input.openingBalance,
    is_active: true,
    created_at: now,
  };

  await db.insert("accounts", row);
  revalidatePath("/");
  revalidatePath("/accounts");
  return accountToUi(row);
}

export async function updateAccount(
  id: string,
  raw: NewAccountInput
): Promise<Account | null> {
  const input = v.accountInput.parse(raw) as NewAccountInput;
  v.idInput.parse(id);
  const patch: Partial<AccountRow> = {
    parent_id: input.parentId,
    is_group: input.isGroup,
    name: enc(input.name)!,
    type: input.type,
    subtype: input.isGroup ? null : input.subtype,
    normal_balance: input.type === "asset" ? "debit" : "credit",
    institution: enc(input.institution),
    account_number: input.isGroup ? null : enc(input.accountNumber),
    currency: input.currency,
    opening_balance: input.isGroup ? 0 : input.openingBalance,
  };
  const updated = await db.update("accounts", id, patch);
  revalidatePath("/");
  revalidatePath("/accounts");
  return updated ? accountToUi(updated) : null;
}

/**
 * Delete an account. Any direct children are promoted to top-level (un-nested)
 * rather than deleted, so a group can be removed without losing its banks.
 */
export async function deleteAccount(id: string): Promise<void> {
  v.idInput.parse(id);
  const children = await db.selectWhere("accounts", { parent_id: id });
  for (const child of children) await db.update("accounts", child.id, { parent_id: null });
  await db.remove("accounts", id);
  revalidatePath("/");
  revalidatePath("/accounts");
}

/** Build line rows for a transaction; returns [rows, uiItems, total]. */
function buildLines(
  transactionId: string,
  input: NewTransactionInput,
  now: string
): { rows: TransactionLineRow[]; items: TransactionItem[]; total: number } {
  if (!input.items || input.items.length === 0)
    return { rows: [], items: [], total: input.amount };

  const rows: TransactionLineRow[] = input.items.map((it) => ({
    id: randomUUID(),
    transaction_id: transactionId,
    category_id: it.categoryId || null, // "" → null (uuid column)
    description: enc(it.description) ?? "",
    amount: it.amount,
    created_at: now,
  }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { rows, items: rows.map(lineToUi), total };
}

export async function createTransaction(
  raw: NewTransactionInput
): Promise<Transaction> {
  const input = v.transactionInput.parse(raw) as NewTransactionInput;
  const userId = await getUserId();
  const account = await db.findById("accounts", input.accountId);
  const currency = input.currency || account?.currency || "USD";
  const now = new Date().toISOString();
  const id = randomUUID();
  const split = Boolean(input.items && input.items.length);
  const { rows: lineRows, items, total } = buildLines(id, input, now);

  const row: TransactionRow = {
    id,
    user_id: userId,
    org_id: null,
    account_id: input.accountId,
    category_id: split ? null : input.categoryId || null,
    date: input.date,
    description: enc(input.merchant)!,
    amount: split ? total : input.amount,
    currency,
    status: "posted",
    source: "manual",
    external_id: null,
    notes: null,
    ...noReimburse,
    reimburse_person: enc(input.reimbursement?.person ?? null),
    reimburse_amount: input.reimbursement?.amount ?? 0,
    reimburse_note: enc(input.reimbursement?.note ?? null),
    created_at: now,
    updated_at: now,
  };

  await db.insert("transactions", row);
  for (const l of lineRows) await db.insert("transaction_lines", l);
  revalidateTxnViews();
  return transactionToUi(row, items);
}

export async function updateTransaction(
  id: string,
  raw: NewTransactionInput
): Promise<Transaction | null> {
  const input = v.transactionInput.parse(raw) as NewTransactionInput;
  v.idInput.parse(id);
  const account = await db.findById("accounts", input.accountId);
  const currency = input.currency || account?.currency || "USD";
  const now = new Date().toISOString();
  const split = Boolean(input.items && input.items.length);
  const { rows: lineRows, items, total } = buildLines(id, input, now);

  // Replace any existing line items.
  const existing = await db.selectWhere("transaction_lines", { transaction_id: id });
  for (const l of existing) await db.remove("transaction_lines", l.id);
  for (const l of lineRows) await db.insert("transaction_lines", l);

  const updated = await db.update("transactions", id, {
    account_id: input.accountId,
    category_id: split ? null : input.categoryId || null,
    date: input.date,
    description: enc(input.merchant)!,
    amount: split ? total : input.amount,
    currency,
    reimburse_person: enc(input.reimbursement?.person ?? null),
    reimburse_amount: input.reimbursement?.amount ?? 0,
    reimburse_note: enc(input.reimbursement?.note ?? null),
    updated_at: now,
  });
  revalidateTxnViews();
  return updated ? transactionToUi(updated, items) : null;
}

/**
 * Record a refund for a reimbursable expense: mark it settled and post an
 * inflow back to the account flagged so it is NOT counted as income.
 */
export async function settleReimbursement(
  transactionId: string
): Promise<{ updated: Transaction | null; inflow: Transaction | null }> {
  v.idInput.parse(transactionId);
  const userId = await getUserId();
  const txn = await db.findById("transactions", transactionId);
  if (!txn || !txn.reimburse_amount) return { updated: null, inflow: null };
  const now = new Date().toISOString();

  const updated = await db.update("transactions", transactionId, {
    reimburse_settled: true,
    reimburse_settled_at: now,
  });

  const person = dec(txn.reimburse_person);
  const inflow: TransactionRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    account_id: txn.account_id,
    category_id: null,
    date: now.slice(0, 10),
    description: enc(`Reimbursement${person ? ` from ${person}` : ""}`)!,
    amount: Math.abs(txn.reimburse_amount),
    currency: txn.currency,
    status: "posted",
    source: "manual",
    external_id: null,
    notes: enc(`Refund for: ${dec(txn.description)}`),
    ...noReimburse,
    is_reimbursement: true,
    created_at: now,
    updated_at: now,
  };
  await db.insert("transactions", inflow);

  revalidateTxnViews();
  return {
    updated: updated ? transactionToUi(updated) : null,
    inflow: transactionToUi(inflow),
  };
}

/**
 * Record an incoming repayment the user actually received, choosing which
 * reimbursable expense it settles. The inflow is flagged so it is NOT income.
 */
export async function recordRepayment(
  raw: RepaymentInput
): Promise<{ updated: Transaction | null; inflow: Transaction | null }> {
  const input = v.repaymentInput.parse(raw) as RepaymentInput;
  const userId = await getUserId();
  const claim = await db.findById("transactions", input.claimId);
  const now = new Date().toISOString();

  const updated = await db.update("transactions", input.claimId, {
    reimburse_settled: true,
    reimburse_settled_at: now,
  });

  const person = dec(claim?.reimburse_person);
  const inflow: TransactionRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    account_id: input.accountId,
    category_id: null,
    date: input.date,
    description: enc(`Repayment${person ? ` from ${person}` : ""}`)!,
    amount: Math.abs(input.amount),
    currency: input.currency,
    status: "posted",
    source: "manual",
    external_id: null,
    notes: claim ? enc(`Refund for: ${dec(claim.description)}`) : null,
    ...noReimburse,
    is_reimbursement: true,
    settles_id: input.claimId,
    created_at: now,
    updated_at: now,
  };
  await db.insert("transactions", inflow);

  revalidateTxnViews();
  return {
    updated: updated ? transactionToUi(updated) : null,
    inflow: transactionToUi(inflow),
  };
}

/**
 * Move money from an account to another account or an asset. Both legs are
 * flagged is_transfer so they're excluded from income/expense — only balances
 * (and net worth) move. Account→asset bumps the asset's value.
 */
export async function recordTransfer(
  raw: TransferInput
): Promise<{ source: Transaction; dest: Transaction | null; asset: Asset | null }> {
  const input = v.transferInput.parse(raw) as TransferInput;
  const userId = await getUserId();
  const now = new Date().toISOString();
  const from = await db.findById("accounts", input.fromAccountId);
  const fromCur = from?.currency ?? "USD";
  const fromName = dec(from?.name) ?? "account";

  const leg = (
    accountId: string,
    amount: number,
    currency: string,
    desc: string
  ): TransactionRow => ({
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    account_id: accountId,
    category_id: null,
    date: input.date,
    description: enc(desc)!,
    amount,
    currency,
    status: "posted",
    source: "manual",
    external_id: null,
    notes: input.note ? enc(input.note) : null,
    ...noReimburse,
    is_transfer: true,
    created_at: now,
    updated_at: now,
  });

  let destLabel = "transfer";
  let dest: Transaction | null = null;
  let assetUi: Asset | null = null;

  if (input.toKind === "account") {
    const to = await db.findById("accounts", input.toId);
    destLabel = dec(to?.name) ?? "account";
    const destRow = leg(
      input.toId,
      Math.abs(input.toAmount),
      to?.currency ?? fromCur,
      `Transfer from ${fromName}`
    );
    await db.insert("transactions", destRow);
    dest = transactionToUi(destRow);
  } else {
    const asset = await db.findById("assets", input.toId);
    if (asset) {
      destLabel = dec(asset.name) ?? "asset";
      const updated = await db.update("assets", input.toId, {
        value: asset.value + Math.abs(input.toAmount),
        updated_at: now,
      });
      assetUi = updated ? assetToUi(updated) : null;
    }
  }

  const sourceRow = leg(
    input.fromAccountId,
    -Math.abs(input.amount),
    fromCur,
    `Transfer to ${destLabel}`
  );
  await db.insert("transactions", sourceRow);

  revalidateTxnViews();
  revalidatePath("/assets");
  return { source: transactionToUi(sourceRow), dest, asset: assetUi };
}

/**
 * Reconcile an account to a real-world balance by posting a one-line balance
 * adjustment (the delta). Flagged is_transfer so it's excluded from income/
 * expense — it only moves the account's balance.
 */
export async function adjustBalance(
  accountId: string,
  delta: number
): Promise<Transaction | null> {
  v.idInput.parse(accountId);
  if (!Number.isFinite(delta)) throw new Error("Invalid adjustment amount");
  delta = Math.trunc(delta);
  if (delta === 0) return null;
  const userId = await getUserId();
  const account = await db.findById("accounts", accountId);
  const now = new Date().toISOString();
  const row: TransactionRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    account_id: accountId,
    category_id: null,
    date: now.slice(0, 10),
    description: enc("Balance adjustment")!,
    amount: delta,
    currency: account?.currency ?? "USD",
    status: "posted",
    source: "manual",
    external_id: null,
    notes: null,
    ...noReimburse,
    is_transfer: true,
    created_at: now,
    updated_at: now,
  };
  await db.insert("transactions", row);
  revalidateTxnViews();
  revalidatePath("/accounts");
  return transactionToUi(row);
}

export async function deleteTransaction(id: string): Promise<void> {
  v.idInput.parse(id);
  const existing = await db.selectWhere("transaction_lines", { transaction_id: id });
  for (const l of existing) await db.remove("transaction_lines", l.id);
  await db.remove("transactions", id);
  revalidateTxnViews();
}

export type ImportRow = {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number; // signed minor units in the account's currency
};

/**
 * Bulk-import parsed bank-statement rows into one account. Dedupes against
 * previously imported rows via a deterministic external_id so re-uploading the
 * same statement is safe. Returns { inserted, skipped }.
 */
export async function importTransactions(
  accountId: string,
  defaultCategoryId: string | null,
  rawRows: ImportRow[]
): Promise<{ created: Transaction[]; skipped: number }> {
  v.idInput.parse(accountId);
  if (defaultCategoryId) v.idInput.parse(defaultCategoryId);
  const rows = v.importRows.parse(rawRows) as ImportRow[];
  const userId = await getUserId();
  const account = await db.findById("accounts", accountId);
  const currency = account?.currency ?? "USD";
  const now = new Date().toISOString();

  const existing = await db.selectAll("transactions");
  const seen = new Set(
    existing.map((e) => e.external_id).filter((x): x is string => Boolean(x))
  );

  const created: Transaction[] = [];
  let skipped = 0;

  for (const r of rows) {
    // Hashed so the dedupe key never stores the plaintext description.
    const ext = hashToken(`${accountId}:${r.date}:${r.amount}:${r.description}`);
    if (seen.has(ext)) {
      skipped++;
      continue;
    }
    seen.add(ext);
    const row: TransactionRow = {
      id: randomUUID(),
      user_id: userId,
      org_id: null,
      account_id: accountId,
      category_id: defaultCategoryId || null,
      date: r.date,
      description: enc(r.description || "Imported transaction")!,
      amount: r.amount,
      currency,
      status: "posted",
      source: "import",
      external_id: ext,
      notes: null,
      ...noReimburse,
      created_at: now,
      updated_at: now,
    };
    await db.insert("transactions", row);
    created.push(transactionToUi(row));
  }

  revalidateTxnViews();
  return { created, skipped };
}

function revalidateTxnViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  revalidatePath("/budgets");
}

// ── Settings: display (base) currency + FX rates ────────────────────────────
export type AppSettings = {
  baseCurrency: string;
  rates: Record<string, number>;
  /** Preferred account, pre-selected when adding a transaction. */
  defaultAccountId?: string | null;
};

/** Default the display currency to whichever currency the user uses most. */
async function defaultBaseCurrency(): Promise<string> {
  const txns = await db.selectAll("transactions");
  const byCount = new Map<string, number>();
  for (const t of txns) byCount.set(t.currency, (byCount.get(t.currency) ?? 0) + 1);
  if (byCount.size)
    return [...byCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const accts = await db.selectAll("accounts");
  const aCount = new Map<string, number>();
  for (const a of accts) if (!a.is_group) aCount.set(a.currency, (aCount.get(a.currency) ?? 0) + 1);
  if (aCount.size)
    return [...aCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

  return DEFAULT_BASE_CURRENCY;
}

export async function getSettings(): Promise<AppSettings> {
  if (!SUPABASE_CONFIGURED) {
    const saved = await db.readSettings<Partial<AppSettings>>();
    const rates = { ...DEFAULT_RATES, ...(saved?.rates ?? {}) };
    const baseCurrency = saved?.baseCurrency || (await defaultBaseCurrency());
    return { baseCurrency, rates, defaultAccountId: saved?.defaultAccountId ?? null };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("*").maybeSingle();
  const saved = data as UserSettingsRow | null;
  const rates = { ...DEFAULT_RATES, ...(saved?.rates ?? {}) };
  const baseCurrency = saved?.base_currency || (await defaultBaseCurrency());
  return {
    baseCurrency,
    rates,
    defaultAccountId: saved?.default_account_id ?? null,
  };
}

export async function updateSettings(raw: AppSettings): Promise<AppSettings> {
  const s = v.settingsInput.parse(raw) as AppSettings;
  if (!SUPABASE_CONFIGURED) {
    await db.writeSettings(s);
    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/reports");
    revalidatePath("/budgets");
    revalidatePath("/accounts");
    revalidatePath("/ledger");
    revalidatePath("/settings");
    return s;
  }
  const userId = await getUserId();
  const supabase = await createClient();
  await supabase.from("user_settings").upsert({
    user_id: userId,
    base_currency: s.baseCurrency,
    rates: s.rates,
    default_account_id: s.defaultAccountId ?? null,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/budgets");
  revalidatePath("/accounts");
  revalidatePath("/ledger");
  revalidatePath("/settings");
  return s;
}

// ── Budgets ─────────────────────────────────────────────────────────────────
function budgetToUi(r: BudgetRow): Budget {
  return { id: r.id, categoryId: r.category_id, amount: r.amount, period: r.period };
}

export async function listBudgets(): Promise<Budget[]> {
  const rows = await db.selectAll("budgets");
  return rows.map(budgetToUi);
}

/** Set the monthly budget for a category (base-currency minor units). 0 clears it. */
export async function setBudget(
  categoryId: string,
  amount: number
): Promise<Budget | null> {
  v.idInput.parse(categoryId);
  if (!Number.isFinite(amount)) throw new Error("Invalid budget amount");
  amount = Math.trunc(amount);
  const userId = await getUserId();
  const existing = (
    await db.selectWhere("budgets", { category_id: categoryId })
  )[0];

  if (amount <= 0) {
    if (existing) await db.remove("budgets", existing.id);
    revalidatePath("/budgets");
    return null;
  }

  if (existing) {
    const updated = await db.update("budgets", existing.id, { amount });
    revalidatePath("/budgets");
    return updated ? budgetToUi(updated) : null;
  }

  const row: BudgetRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    category_id: categoryId,
    period: "monthly",
    amount,
    starts_on: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };
  await db.insert("budgets", row);
  revalidatePath("/budgets");
  return budgetToUi(row);
}

// ── Savings goals ────────────────────────────────────────────────────────────
function goalToUi(r: GoalRow): Goal {
  return {
    id: r.id,
    name: r.name,
    target: r.target_amount,
    saved: r.saved_amount,
    currency: r.currency,
    targetDate: r.target_date,
    tint: r.color ?? "var(--chart-1)",
  };
}

function revalidateGoalViews() {
  revalidatePath("/");
  revalidatePath("/goals");
}

export async function listGoals(): Promise<Goal[]> {
  const rows = await db.selectAll("goals");
  return rows.map(goalToUi);
}

export async function createGoal(raw: NewGoalInput): Promise<Goal> {
  const input = v.goalInput.parse(raw) as NewGoalInput;
  const userId = await getUserId();
  const now = new Date().toISOString();
  const row: GoalRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    name: input.name,
    target_amount: input.target,
    saved_amount: input.saved,
    currency: input.currency,
    target_date: input.targetDate,
    color: input.color,
    created_at: now,
    updated_at: now,
  };
  await db.insert("goals", row);
  revalidateGoalViews();
  return goalToUi(row);
}

export async function updateGoal(
  id: string,
  raw: NewGoalInput
): Promise<Goal | null> {
  const input = v.goalInput.parse(raw) as NewGoalInput;
  v.idInput.parse(id);
  const updated = await db.update("goals", id, {
    name: input.name,
    target_amount: input.target,
    saved_amount: input.saved,
    currency: input.currency,
    target_date: input.targetDate,
    color: input.color,
    updated_at: new Date().toISOString(),
  });
  revalidateGoalViews();
  return updated ? goalToUi(updated) : null;
}

/** Add (or remove, if negative) funds set aside toward a goal. */
export async function contributeGoal(
  id: string,
  delta: number
): Promise<Goal | null> {
  v.idInput.parse(id);
  v.goalContribution.parse(delta);
  const goal = await db.findById("goals", id);
  if (!goal) return null;
  const saved = Math.max(0, goal.saved_amount + Math.trunc(delta));
  const updated = await db.update("goals", id, {
    saved_amount: saved,
    updated_at: new Date().toISOString(),
  });
  revalidateGoalViews();
  return updated ? goalToUi(updated) : null;
}

export async function deleteGoal(id: string): Promise<void> {
  v.idInput.parse(id);
  await db.remove("goals", id);
  revalidateGoalViews();
}

// ── Recurring rules + bill reminders ─────────────────────────────────────────
function recurringToUi(r: RecurringRow): RecurringRule {
  return {
    id: r.id,
    accountId: r.account_id,
    categoryId: r.category_id ?? "",
    merchant: dec(r.description) ?? "",
    amount: r.amount,
    currency: r.currency,
    cadence: r.cadence,
    nextDate: r.next_date,
    autoPost: r.auto_post,
    lastPosted: r.last_posted,
    active: r.is_active,
  };
}

/** Advance an ISO date by one cadence period (parsed in UTC to avoid drift). */
function advanceDate(iso: string, cadence: RecurringRow["cadence"]): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (cadence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (cadence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function recurringTxnRow(
  rule: RecurringRow,
  date: string,
  userId: string
): TransactionRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    account_id: rule.account_id,
    category_id: rule.category_id,
    date,
    description: rule.description, // already encrypted on the rule
    amount: rule.amount,
    currency: rule.currency,
    status: "posted",
    source: "recurring",
    external_id: null,
    notes: null,
    ...noReimburse,
    created_at: now,
    updated_at: now,
  };
}

function revalidateRecurringViews() {
  revalidatePath("/");
  revalidatePath("/recurring");
}

export async function listRecurring(): Promise<RecurringRule[]> {
  const rows = await db.selectAll("recurring_rules");
  return rows.map(recurringToUi);
}

export async function createRecurring(
  raw: NewRecurringInput
): Promise<RecurringRule> {
  const input = v.recurringInput.parse(raw) as NewRecurringInput;
  const userId = await getUserId();
  const now = new Date().toISOString();
  const row: RecurringRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    account_id: input.accountId,
    category_id: input.categoryId || null,
    description: enc(input.merchant)!,
    amount: input.amount,
    currency: input.currency,
    cadence: input.cadence,
    next_date: input.nextDate,
    auto_post: input.autoPost,
    last_posted: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  await db.insert("recurring_rules", row);
  revalidateRecurringViews();
  return recurringToUi(row);
}

export async function updateRecurring(
  id: string,
  raw: NewRecurringInput
): Promise<RecurringRule | null> {
  const input = v.recurringInput.parse(raw) as NewRecurringInput;
  v.idInput.parse(id);
  const updated = await db.update("recurring_rules", id, {
    account_id: input.accountId,
    category_id: input.categoryId || null,
    description: enc(input.merchant)!,
    amount: input.amount,
    currency: input.currency,
    cadence: input.cadence,
    next_date: input.nextDate,
    auto_post: input.autoPost,
    updated_at: new Date().toISOString(),
  });
  revalidateRecurringViews();
  return updated ? recurringToUi(updated) : null;
}

export async function deleteRecurring(id: string): Promise<void> {
  v.idInput.parse(id);
  await db.remove("recurring_rules", id);
  revalidateRecurringViews();
}

/** Post a single occurrence of a rule now and advance it one period. */
export async function postRecurring(
  id: string
): Promise<{ transaction: Transaction | null; rule: RecurringRule | null }> {
  v.idInput.parse(id);
  const userId = await getUserId();
  const rule = await db.findById("recurring_rules", id);
  if (!rule) return { transaction: null, rule: null };
  const occurrence = rule.next_date;
  const txn = recurringTxnRow(rule, occurrence, userId);
  await db.insert("transactions", txn);
  const updated = await db.update("recurring_rules", id, {
    next_date: advanceDate(occurrence, rule.cadence),
    last_posted: occurrence,
    updated_at: new Date().toISOString(),
  });
  revalidateTxnViews();
  revalidateRecurringViews();
  return {
    transaction: transactionToUi(txn),
    rule: updated ? recurringToUi(updated) : null,
  };
}

/**
 * Catch up every auto-post rule whose next date has passed: create one
 * transaction per missed occurrence (capped) and advance the rule. Called on
 * app mount. Manual (remind-only) rules are left for the user to post.
 */
export async function runDueRecurring(): Promise<{
  transactions: Transaction[];
  rules: RecurringRule[];
}> {
  const userId = await getUserId();
  const today = new Date().toISOString().slice(0, 10);
  const rules = await db.selectAll("recurring_rules");
  const created: Transaction[] = [];
  const touched: RecurringRule[] = [];

  for (const rule of rules) {
    if (!rule.is_active || !rule.auto_post || rule.next_date > today) continue;
    let cursor = rule.next_date;
    let last = rule.last_posted;
    let guard = 0;
    while (cursor <= today && guard < 36) {
      const txn = recurringTxnRow(rule, cursor, userId);
      await db.insert("transactions", txn);
      created.push(transactionToUi(txn));
      last = cursor;
      cursor = advanceDate(cursor, rule.cadence);
      guard++;
    }
    const updated = await db.update("recurring_rules", rule.id, {
      next_date: cursor,
      last_posted: last,
      updated_at: new Date().toISOString(),
    });
    if (updated) touched.push(recurringToUi(updated));
  }

  if (created.length) {
    revalidateTxnViews();
    revalidateRecurringViews();
  }
  return { transactions: created, rules: touched };
}
