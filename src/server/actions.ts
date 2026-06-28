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
  type BudgetRow,
  type CategoryRow,
  type NewAccountInput,
  type NewAssetInput,
  type NewCategoryInput,
  type NewTransactionInput,
  type RepaymentInput,
  type TransferInput,
  type TransactionLineRow,
  type TransactionRow,
  type UserSettingsRow,
} from "@/lib/schema";
import type {
  Account,
  Asset,
  Budget,
  Category,
  Transaction,
  TransactionItem,
} from "@/lib/data";
import { DEFAULT_BASE_CURRENCY, DEFAULT_RATES } from "@/lib/currency";

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
  redirect("/login");
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
    created_at: now,
    updated_at: now,
  };
  await db.insert("assets", row);
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
    category_id: it.categoryId,
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
    category_id: split ? null : input.categoryId,
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
    category_id: split ? null : input.categoryId,
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
      category_id: defaultCategoryId,
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
    return { baseCurrency, rates };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("*").maybeSingle();
  const saved = data as UserSettingsRow | null;
  const rates = { ...DEFAULT_RATES, ...(saved?.rates ?? {}) };
  const baseCurrency = saved?.base_currency || (await defaultBaseCurrency());
  return { baseCurrency, rates };
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
