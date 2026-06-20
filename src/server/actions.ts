"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import * as db from "@/server/db";
import { enc, dec, hashToken } from "@/server/crypto";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import {
  DEMO_USER_ID,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type NewAccountInput,
  type NewCategoryInput,
  type NewTransactionInput,
  type RepaymentInput,
  type TransactionLineRow,
  type TransactionRow,
  type UserSettingsRow,
} from "@/lib/schema";
import type {
  Account,
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
    settlesId: r.settles_id ?? undefined,
  };
}

// Default reimbursement columns for new rows.
const noReimburse = {
  reimburse_person: null,
  reimburse_amount: 0,
  reimburse_note: null,
  reimburse_settled: false,
  reimburse_settled_at: null,
  is_reimbursement: false,
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

function revalidateCategoryViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/reports");
  revalidatePath("/ledger");
  revalidatePath("/settings");
}

export async function createCategory(input: NewCategoryInput): Promise<Category> {
  const userId = await getUserId();
  const row: CategoryRow = {
    id: randomUUID(),
    user_id: userId,
    org_id: null,
    name: input.name,
    kind: input.kind,
    color: input.color,
    parent_id: null,
    created_at: new Date().toISOString(),
  };
  await db.insert("categories", row);
  revalidateCategoryViews();
  return categoryToUi(row);
}

export async function updateCategory(
  id: string,
  input: NewCategoryInput
): Promise<Category | null> {
  const updated = await db.update("categories", id, {
    name: input.name,
    kind: input.kind,
    color: input.color,
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
export async function createAccount(input: NewAccountInput): Promise<Account> {
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
  input: NewAccountInput
): Promise<Account | null> {
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
  input: NewTransactionInput
): Promise<Transaction> {
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
  input: NewTransactionInput
): Promise<Transaction | null> {
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
  input: RepaymentInput
): Promise<{ updated: Transaction | null; inflow: Transaction | null }> {
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

export async function deleteTransaction(id: string): Promise<void> {
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
  rows: ImportRow[]
): Promise<{ created: Transaction[]; skipped: number }> {
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

export async function updateSettings(s: AppSettings): Promise<AppSettings> {
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
