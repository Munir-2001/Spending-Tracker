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
  swift: string | null; // BIC — public bank identifier
  iban: string | null; // encrypted at rest
  branch: string | null; // branch name/code — encrypted at rest
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
  // True for both legs of a transfer between accounts/assets (not income/expense).
  is_transfer: boolean;
  // User flag: an inflow that should never count as income (refund, gift, …).
  not_income: boolean;
  // For a repayment inflow: the reimbursable transaction it settles.
  settles_id: string | null;
  // For an invoice-payment inflow: the invoice it pays (see 0016). Optional on
  // write (column defaults NULL); always present on read. Set only by
  // markInvoicePaid/recordInvoicePayment so paid invoices count as income.
  invoice_id?: string | null;
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
  // True when this specific item was bought for a friend (owed back to you).
  // The parent transaction carries the claim (person / owed total / settled).
  reimbursable: boolean;
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

export type AssetType =
  | "property"
  | "vehicle"
  | "crypto"
  | "gold"
  | "investment"
  | "cash"
  | "valuable"
  | "other";

/** Physical unit a precious-metal holding is measured in. */
export type MetalUnit = "tola" | "gram" | "gram10" | "ozt";

export type AssetRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string; // encrypted at rest
  type: AssetType;
  value: number; // minor units of `currency` (for gold: last-known market value)
  currency: string;
  note: string | null; // encrypted at rest
  // Market-priced holdings (gold, later silver/crypto). Null for manual assets.
  symbol: string | null; // e.g. "XAU"
  quantity: number | null; // amount held, in `unit`
  unit: MetalUnit | null;
  karat: number | null; // 24 = pure; scales value by karat/24
  cost_basis: number | null; // minor units of `currency` — what you paid
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  base_currency: string;
  rates: Record<string, number>;
  default_account_id: string | null;
  timezone: string | null; // IANA tz for local-night net-worth snapshots
  updated_at: string;
};

export type FeedbackRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  rating: number | null;
  message: string; // plain text (readable in the dashboard)
  page: string | null;
  created_at: string;
};

/** Input for submitting feedback (UI-facing). */
export type NewFeedbackInput = {
  message: string;
  rating?: number | null;
  page?: string | null;
};

/**
 * A point-in-time net-worth capture (base-currency minor units) at a closing
 * date. Written with the rates/prices live at capture time, so historical
 * points are immutable — refreshing FX later never rewrites the past.
 */
export type NetWorthSnapshotRow = {
  id: string;
  user_id: string;
  as_of: string; // yyyy-mm-dd closing date
  value_minor: number;
  base_currency: string;
  breakdown: { accounts?: number; assets?: number; receivables?: number };
  approximate: boolean; // true for the one-time backfill seed
  created_at: string;
};

/**
 * A single purchase ("lot") of a market-priced holding (gold now, crypto later).
 * The parent AssetRow keeps the aggregate quantity/cost_basis; lots are the
 * source of truth for cost basis and per-purchase P/L.
 */
export type AssetLotRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  asset_id: string;
  date: string; // ISO date
  quantity: number; // amount bought, in `unit` (or raw coin amount for crypto)
  unit: MetalUnit | null; // null for crypto (no metal unit)
  karat: number | null; // 24 = pure; null for non-metal
  gold_cost: number; // metal price paid, minor units of `currency`
  commission: number; // making / dealer commission, minor units
  tax: number; // optional tax, minor units
  cost_basis: number; // = gold_cost + commission + tax
  currency: string;
  // USD value of 1 unit of `currency` at purchase; null → use current rate.
  purchase_fx_rate: number | null;
  note: string | null; // encrypted at rest
  created_at: string;
  updated_at: string;
};

/** A savings goal — envelope-style progress toward a target. */
export type GoalRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  target_amount: number; // minor units of `currency`
  saved_amount: number; // minor units; current progress
  currency: string;
  target_date: string | null; // optional ISO deadline
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringCadence = "weekly" | "monthly" | "yearly";

/** A scheduled recurring transaction (rent, salary, a subscription). */
export type RecurringRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  account_id: string;
  category_id: string | null;
  description: string; // encrypted at rest
  amount: number; // signed minor units (neg = bill/expense, pos = income)
  currency: string;
  cadence: RecurringCadence;
  next_date: string; // ISO date of the next occurrence
  auto_post: boolean; // true = auto-create when due; false = remind only
  last_posted: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ── Invoicing (business tier) ───────────────────────────────────────────────

/** A billable customer. All PII columns are encrypted at rest. */
export type ClientRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string; // encrypted
  email: string | null; // encrypted
  phone: string | null; // encrypted
  address: string | null; // encrypted (multi-line)
  tax_id: string | null; // encrypted
  currency: string; // default billing currency
  notes: string | null; // encrypted
  created_at: string;
  updated_at: string;
};

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "overdue"
  | "void";

/**
 * A billing document. Totals are minor units and always recomputed server-side
 * from the lines — never trusted from the client. `status` is stored, but the
 * "overdue" reading is derived at read time (due_date past & not fully paid).
 */
export type InvoiceRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  client_id: string | null;
  number: string; // "INV-0007", unique per user
  status: InvoiceStatus;
  issue_date: string; // iso date
  due_date: string; // iso date
  currency: string;
  subtotal: number; // cents, Σ line amounts pre-tax/discount
  discount_total: number; // cents
  tax_total: number; // cents, Σ per-line tax
  total: number; // cents, subtotal - discount + tax
  amount_paid: number; // cents, 0..total
  account_id: string | null; // account a payment lands in
  payment_account_id: string | null; // receiving bank shown on the invoice
  notes: string | null; // encrypted, customer-facing
  terms: string | null; // encrypted, payment terms / footer
  public_token: string | null; // unguessable share/PDF link token
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A receiving bank account shown on invoices so clients know where to pay.
 * Personal fields (title/number/IBAN/branch/notes) are encrypted at rest.
 */
export type PaymentAccountRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  label: string; // nickname
  account_name: string; // account title / holder (encrypted)
  bank_name: string | null;
  account_number: string | null; // encrypted
  iban: string | null; // encrypted
  swift: string | null; // BIC
  branch_code: string | null; // encrypted
  currency: string;
  notes: string | null; // encrypted
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

/** A single invoice line item, with its own tax rate (VAT/GST-style). */
export type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  description: string; // encrypted
  quantity: number; // may be fractional (hours/units)
  unit_price: number; // cents
  amount: number; // cents = round(quantity * unit_price)
  tax_rate: number | null; // percent 0..100; null = no tax
  sort_order: number;
  created_at: string;
};

/** Maps a table name to its row type — used by the generic data store. */
export type TableMap = {
  profiles: ProfileRow;
  accounts: AccountRow;
  categories: CategoryRow;
  transactions: TransactionRow;
  transaction_lines: TransactionLineRow;
  budgets: BudgetRow;
  assets: AssetRow;
  asset_lots: AssetLotRow;
  goals: GoalRow;
  recurring_rules: RecurringRow;
  user_settings: UserSettingsRow;
  feedback: FeedbackRow;
  net_worth_snapshots: NetWorthSnapshotRow;
  clients: ClientRow;
  invoices: InvoiceRow;
  invoice_lines: InvoiceLineRow;
  payment_accounts: PaymentAccountRow;
};

export type TableName = keyof TableMap;

/** A line item when itemizing a transaction. */
export type NewTransactionLine = {
  categoryId: string;
  description: string;
  amount: number; // signed minor units (same direction as the total)
  /** When true, this item was bought for a friend (counts toward what's owed). */
  reimbursable?: boolean;
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
  /** Manual flag: this inflow should never count as income (refund, gift, …). */
  notIncome?: boolean;
};

/** Input for moving money between an account and another account or asset. */
export type TransferInput = {
  fromKind: "account" | "asset";
  fromId: string;
  toKind: "account" | "asset";
  toId: string;
  amount: number; // positive minor units, in the SOURCE's currency
  toAmount: number; // positive minor units, in the destination's currency
  date: string;
  note: string;
};

/** Input for recording a repayment inflow that settles a reimbursable expense. */
export type RepaymentInput = {
  claimId: string;
  accountId: string;
  amount: number; // signed/positive minor units in `currency`
  currency: string;
  date: string;
};

/** Input for creating/editing an asset. */
export type NewAssetInput = {
  name: string;
  type: AssetType;
  value: number; // minor units of `currency`
  currency: string;
  note: string | null;
  // Market-priced (gold) fields — omit/null for manual assets.
  symbol?: string | null;
  quantity?: number | null;
  unit?: MetalUnit | null;
  karat?: number | null;
  costBasis?: number | null;
  // For a new gold asset: the itemized cost of the FIRST purchase, so the
  // create action can seed the parent + its first lot atomically.
  firstLot?: {
    date: string;
    goldCost: number; // minor units of `currency`
    commission: number;
    tax: number;
  };
};

/** Input for creating/editing a purchase lot (UI-facing, camelCase). */
export type NewAssetLotInput = {
  assetId: string;
  date: string; // ISO date
  quantity: number; // in `unit` (or raw coin amount for crypto)
  unit: MetalUnit | null; // null for crypto
  karat: number | null;
  goldCost: number; // minor units of `currency`
  commission: number;
  tax: number;
  currency: string;
  note?: string | null;
};

/** Input for creating/editing a category (UI-facing, camelCase). */
export type NewCategoryInput = {
  name: string;
  kind: CategoryKind;
  color: string;
  parentId: string | null;
};

/** Input for creating an account (UI-facing, camelCase). */
export type NewAccountInput = {
  name: string;
  type: "asset" | "liability";
  subtype: AccountSubtype | null;
  currency: string;
  institution: string | null;
  accountNumber: string | null;
  swift?: string | null; // BIC — public bank identifier
  iban?: string | null; // encrypted at rest
  branch?: string | null; // branch name/code
  openingBalance: number; // minor units of `currency`
  parentId: string | null;
  isGroup: boolean;
};

/** Input for creating/editing a savings goal (UI-facing, camelCase). */
export type NewGoalInput = {
  name: string;
  target: number; // minor units of `currency`
  saved: number; // minor units already set aside
  currency: string;
  targetDate: string | null;
  color: string;
};

/** Input for creating/editing a recurring rule (UI-facing, camelCase). */
export type NewRecurringInput = {
  merchant: string;
  amount: number; // signed minor units (neg = bill/expense, pos = income)
  categoryId: string; // may be "" for income / uncategorized
  accountId: string;
  currency: string;
  cadence: RecurringCadence;
  nextDate: string;
  autoPost: boolean;
};

/** Input for creating/editing a client (UI-facing, camelCase). */
export type NewClientInput = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  currency: string;
  notes: string | null;
};

/** A single invoice line when creating/editing an invoice (UI-facing). */
export type NewInvoiceLine = {
  description: string;
  quantity: number; // may be fractional
  unitPrice: number; // minor units
  taxRate?: number | null; // percent 0..100; null/omit = no tax
};

/** Input for creating/editing an invoice (UI-facing, camelCase). */
export type NewInvoiceInput = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  discountTotal?: number; // minor units, applied to subtotal
  accountId?: string | null; // where a payment will land
  paymentAccountId?: string | null; // receiving bank shown on the invoice
  notes?: string | null;
  terms?: string | null;
  lines: NewInvoiceLine[];
};

/** Input for creating/editing a receiving bank account (UI-facing). */
export type NewPaymentAccountInput = {
  label: string;
  accountName: string;
  bankName: string | null;
  accountNumber: string | null;
  iban: string | null;
  swift: string | null;
  branchCode: string | null;
  currency: string;
  notes: string | null;
  isDefault: boolean;
};

/** Input for recording a (possibly partial) invoice payment. */
export type InvoicePaymentInput = {
  invoiceId: string;
  accountId: string;
  amount: number; // positive minor units, in the invoice's currency
  date: string;
};

/** The single demo user until Supabase Auth is wired. */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
