/**
 * UI-facing domain types (camelCase). These are what components consume; the
 * persisted DB row types live in `@/lib/schema` and are mapped to these in the
 * server actions. All amounts are integer MINOR UNITS of the row's `currency`.
 */

import type {
  AccountSubtype,
  AssetType,
  BudgetPeriod,
  CategoryKind,
  InvoiceStatus,
  MetalUnit,
  RecurringCadence,
} from "@/lib/schema";

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  value: number; // minor units of `currency` (for gold: last-known market value)
  currency: string;
  note: string | null;
  // Market-priced (gold) fields; null for manual assets.
  symbol: string | null;
  quantity: number | null;
  unit: MetalUnit | null;
  karat: number | null;
  costBasis: number | null; // minor units of `currency` — what you paid
  // Per-purchase lots (gold). Populated for market-priced holdings.
  lots?: AssetLot[];
};

/** A single purchase of a market-priced holding (gold). All amounts minor units. */
export type AssetLot = {
  id: string;
  assetId: string;
  date: string; // ISO date
  quantity: number; // in `unit` (or raw coin amount for crypto)
  unit: MetalUnit | null; // null for crypto
  karat: number | null;
  goldCost: number; // metal price paid
  commission: number; // making / dealer commission
  tax: number; // optional tax
  costBasis: number; // = goldCost + commission + tax
  currency: string;
  purchaseFxRate: number | null; // USD value of 1 unit of `currency` at purchase
  note: string | null;
};

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  accountNumber: string | null; // decrypted for the owner; shown masked
  swift: string | null; // BIC — public bank identifier
  iban: string | null; // decrypted for the owner
  branch: string | null; // branch name/code
  type: "asset" | "liability";
  subtype: AccountSubtype | null;
  currency: string;
  parentId: string | null;
  isGroup: boolean;
  openingBalance: number; // minor units
};

export type Category = {
  id: string;
  label: string;
  kind: CategoryKind;
  tint: string;
  parentId: string | null; // null = top-level; otherwise a sub-category
};

export type TransactionItem = {
  id: string;
  categoryId: string;
  description: string;
  amount: number; // minor units of the parent currency, signed
  /** True when this item was bought for a friend (part of the parent's claim). */
  reimbursable?: boolean;
};

export type Transaction = {
  id: string;
  date: string; // ISO date
  merchant: string;
  categoryId: string;
  accountId: string;
  amount: number; // minor units of `currency`, signed (neg = out)
  currency: string;
  pending?: boolean;
  /** Present when the transaction is split into multiple categorized items. */
  items?: TransactionItem[];
  /** Present when this expense was fronted for someone ("bought for a friend"). */
  reimbursement?: {
    person: string;
    amount: number; // minor units owed back to you
    note: string;
    settled: boolean;
    settledAt: string | null;
  };
  /** True for the inflow recorded when a reimbursement is refunded (not income). */
  isReimbursement?: boolean;
  /** True for a leg of a transfer between accounts/assets (not income/expense). */
  isTransfer?: boolean;
  /** Manual flag: an inflow the user marked as never counting toward income. */
  notIncome?: boolean;
  /** For a repayment inflow: the id of the reimbursable transaction it settles. */
  settlesId?: string;
  /** For an invoice-payment inflow: the id of the invoice it pays. */
  invoiceId?: string | null;
  /** Free-text note (transfer memo, refund reference, etc.). */
  notes?: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number; // base-currency minor units
  period: BudgetPeriod;
};

export type Goal = {
  id: string;
  name: string;
  target: number; // minor units of `currency`
  saved: number; // minor units already set aside
  currency: string;
  targetDate: string | null;
  tint: string;
};

export type Feedback = {
  id: string;
  message: string;
  rating: number | null;
  page: string | null;
  createdAt: string; // ISO
};

export type RecurringRule = {
  id: string;
  accountId: string;
  categoryId: string; // "" when uncategorized
  merchant: string;
  amount: number; // signed minor units (neg = bill, pos = income)
  currency: string;
  cadence: RecurringCadence;
  nextDate: string; // ISO date of next occurrence
  autoPost: boolean;
  lastPosted: string | null;
  active: boolean;
};

// ── Invoicing (business tier) ───────────────────────────────────────────────

/** A billable customer (decrypted for the owner). */
export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  currency: string;
  notes: string | null;
};

/** A receiving bank account shown on invoices (decrypted for the owner). */
export type PaymentAccount = {
  id: string;
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

/** A single invoice line item, with its own tax rate. */
export type InvoiceLine = {
  id: string;
  description: string;
  quantity: number; // may be fractional
  unitPrice: number; // minor units
  amount: number; // minor units = round(quantity * unitPrice)
  taxRate: number | null; // percent 0..100; null = no tax
};

/**
 * A billing document. All money is minor units of `currency`. `overdue` is a
 * derived reading (due date past and not fully paid) surfaced alongside the
 * stored status. Lines are attached when a single invoice is loaded.
 */
export type Invoice = {
  id: string;
  clientId: string | null;
  number: string;
  status: InvoiceStatus;
  overdue: boolean; // derived: due_date past & amountPaid < total & not paid/void
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  accountId: string | null;
  paymentAccountId: string | null;
  notes: string | null;
  terms: string | null;
  publicToken: string | null;
  sentAt: string | null;
  paidAt: string | null;
  lines?: InvoiceLine[];
  /** Resolved receiving-bank details, attached when a single invoice is loaded. */
  paymentAccount?: PaymentAccount | null;
};

/**
 * A persisted point-in-time net-worth capture (base-currency minor units at
 * `asOf`, using the rates/prices live when it was taken). `approximate` marks
 * the one-time backfill seed vs. a true month-end snapshot.
 */
export type NetWorthSnapshot = {
  id: string;
  asOf: string; // yyyy-mm-dd closing date
  value: number; // minor units of `baseCurrency`
  baseCurrency: string;
  breakdown: { accounts?: number; assets?: number; receivables?: number };
  approximate: boolean;
};
