/**
 * TypeScript mirror of the Postgres schema in
 * `supabase/migrations/0001_initial_schema.sql`.
 *
 * Row types use snake_case to match Postgres / supabase-js output exactly, so
 * the file-based store today and Supabase tomorrow return identical shapes.
 * The UI keeps its own camelCase types (see `@/lib/data`); map at the boundary.
 */

// ── Enums (mirror the SQL enum types) ───────────────────────────────────────
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountSubtype =
  | "checking"
  | "savings"
  | "credit_card"
  | "cash"
  | "loan"
  | "investment"
  | "other";
export type NormalBalance = "debit" | "credit";
export type TxnStatus = "pending" | "posted" | "cleared" | "reconciled" | "void";
export type TxnSource = "manual" | "import" | "recurring";
export type CategoryKind = "income" | "expense";
export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

// ── Row types ───────────────────────────────────────────────────────────────
export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  base_currency: string;
  created_at: string;
};

export type AccountRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  parent_id: string | null; // nesting: e.g. "Pakistani Accounts" → bank children
  is_group: boolean; // a folder that rolls up children; holds no transactions
  code: string | null;
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
  normal_balance: NormalBalance;
  institution: string | null;
  mask: string | null;
  account_number: string | null; // encrypted at rest
  currency: string;
  opening_balance: number; // minor units of `currency`
  is_active: boolean;
  created_at: string;
};

export type CategoryRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  kind: CategoryKind;
  color: string | null;
  parent_id: string | null;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  account_id: string;
  category_id: string | null;
  date: string; // ISO date
  description: string;
  amount: number; // cents, signed
  currency: string;
  status: TxnStatus;
  source: TxnSource;
  external_id: string | null;
  notes: string | null;
  // Reimbursable expense ("bought for a friend"). amount = what they owe you.
  reimburse_person: string | null;
  reimburse_amount: number; // minor units; 0 = not reimbursable
  reimburse_note: string | null;
  reimburse_settled: boolean;
  reimburse_settled_at: string | null;
  // True for the inflow created when a reimbursement is refunded (not income).
  is_reimbursement: boolean;
  // For a repayment inflow: the reimbursable transaction it settles.
  settles_id: string | null;
  created_at: string;
  updated_at: string;
};

/** A single line item of an itemized (split) transaction. */
export type TransactionLineRow = {
  id: string;
  transaction_id: string;
  category_id: string | null;
  description: string;
  amount: number; // minor units, signed (same direction as the parent total)
  created_at: string;
};

export type BudgetRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  category_id: string;
  period: BudgetPeriod;
  amount: number; // cents
  starts_on: string;
  created_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  base_currency: string;
  rates: Record<string, number>;
  updated_at: string;
};

/** Maps a table name to its row type — used by the generic data store. */
export type TableMap = {
  profiles: ProfileRow;
  accounts: AccountRow;
  categories: CategoryRow;
  transactions: TransactionRow;
  transaction_lines: TransactionLineRow;
  budgets: BudgetRow;
  user_settings: UserSettingsRow;
};

export type TableName = keyof TableMap;

/** A line item when itemizing a transaction. */
export type NewTransactionLine = {
  categoryId: string;
  description: string;
  amount: number; // signed minor units (same direction as the total)
};

/** Input for creating a transaction (UI-facing, camelCase). */
export type NewTransactionInput = {
  merchant: string;
  amount: number; // signed minor units of `currency` (= sum of items if itemized)
  categoryId: string;
  accountId: string;
  /** Currency the transaction was charged in — may differ from the account's. */
  currency: string;
  date: string;
  /** When present, the transaction is split across these categories. */
  items?: NewTransactionLine[];
  /** When present, marks this expense as reimbursable ("bought for a friend"). */
  reimbursement?: { person: string; amount: number; note: string };
};

/** Input for recording a repayment inflow that settles a reimbursable expense. */
export type RepaymentInput = {
  claimId: string;
  accountId: string;
  amount: number; // signed/positive minor units in `currency`
  currency: string;
  date: string;
};

/** Input for creating/editing a category (UI-facing, camelCase). */
export type NewCategoryInput = {
  name: string;
  kind: CategoryKind;
  color: string;
};

/** Input for creating an account (UI-facing, camelCase). */
export type NewAccountInput = {
  name: string;
  type: "asset" | "liability";
  subtype: AccountSubtype | null;
  currency: string;
  institution: string | null;
  accountNumber: string | null;
  openingBalance: number; // minor units of `currency`
  parentId: string | null;
  isGroup: boolean;
};

/** The single demo user until Supabase Auth is wired. */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
