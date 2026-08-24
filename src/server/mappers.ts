import "server-only";

import { dec } from "@/server/crypto";
import type {
  Account,
  Asset,
  Category,
  NetWorthSnapshot,
  Transaction,
  TransactionItem,
} from "@/lib/data";
import type {
  AccountRow,
  AssetRow,
  CategoryRow,
  NetWorthSnapshotRow,
  TransactionLineRow,
  TransactionRow,
} from "@/lib/schema";

/**
 * Pure row → UI mappers (DB snake_case + encrypted text → camelCase domain
 * types). Shared by the request-scoped server actions and the cron snapshot
 * job, so both interpret a row identically. No I/O — just field mapping and
 * decryption of the owner-encrypted text columns.
 */

export function accountToUi(r: AccountRow): Account {
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

export function categoryToUi(r: CategoryRow): Category {
  return {
    id: r.id,
    label: r.name,
    kind: r.kind,
    tint: r.color ?? "var(--muted-foreground)",
    parentId: r.parent_id ?? null,
  };
}

export function lineToUi(r: TransactionLineRow): TransactionItem {
  return {
    id: r.id,
    categoryId: r.category_id ?? "",
    description: dec(r.description) ?? "",
    amount: r.amount,
    reimbursable: r.reimbursable ?? false,
  };
}

export function transactionToUi(
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
    notIncome: r.not_income ?? false,
    settlesId: r.settles_id ?? undefined,
    notes: dec(r.notes) ?? undefined,
  };
}

export function assetToUi(r: AssetRow): Asset {
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

export function snapshotToUi(r: NetWorthSnapshotRow): NetWorthSnapshot {
  return {
    id: r.id,
    asOf: r.as_of,
    value: r.value_minor,
    baseCurrency: r.base_currency,
    breakdown: r.breakdown ?? {},
    approximate: r.approximate,
  };
}
