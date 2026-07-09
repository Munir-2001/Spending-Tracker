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
};

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  accountNumber: string | null; // decrypted for the owner; shown masked
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
  /** For a repayment inflow: the id of the reimbursable transaction it settles. */
  settlesId?: string;
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
