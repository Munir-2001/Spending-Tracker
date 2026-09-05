import "server-only";

import { dec } from "@/server/crypto";
import { isOverdue } from "@/lib/invoice";
import type {
  Account,
  Asset,
  Category,
  Client,
  Invoice,
  InvoiceLine,
  PaymentAccount,
  NetWorthSnapshot,
  Transaction,
  TransactionItem,
} from "@/lib/data";
import type {
  AccountRow,
  AssetRow,
  CategoryRow,
  ClientRow,
  InvoiceRow,
  InvoiceLineRow,
  PaymentAccountRow,
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
    swift: r.swift ?? null,
    iban: dec(r.iban),
    branch: dec(r.branch),
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
    invoiceId: r.invoice_id ?? null,
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

export function clientToUi(r: ClientRow): Client {
  return {
    id: r.id,
    name: dec(r.name) ?? "",
    email: dec(r.email),
    phone: dec(r.phone),
    address: dec(r.address),
    taxId: dec(r.tax_id),
    currency: r.currency,
    notes: dec(r.notes),
  };
}

export function paymentAccountToUi(r: PaymentAccountRow): PaymentAccount {
  return {
    id: r.id,
    label: r.label,
    accountName: dec(r.account_name) ?? "",
    bankName: r.bank_name,
    accountNumber: dec(r.account_number),
    iban: dec(r.iban),
    swift: r.swift,
    branchCode: dec(r.branch_code),
    currency: r.currency,
    notes: dec(r.notes),
    isDefault: r.is_default ?? false,
  };
}

export function invoiceLineToUi(r: InvoiceLineRow): InvoiceLine {
  return {
    id: r.id,
    description: dec(r.description) ?? "",
    quantity: r.quantity,
    unitPrice: r.unit_price,
    amount: r.amount,
    taxRate: r.tax_rate ?? null,
  };
}

/**
 * Maps an invoice row to the UI type. `today` (yyyy-mm-dd) is passed in — mappers
 * stay pure (no clock) — so `overdue` is derived consistently by the caller:
 * past due date, not fully paid, and not already paid/void.
 */
export function invoiceToUi(
  r: InvoiceRow,
  today: string,
  lines?: InvoiceLine[],
  paymentAccount?: PaymentAccount | null
): Invoice {
  const overdue = isOverdue(r.status, r.total, r.amount_paid, r.due_date, today);
  return {
    id: r.id,
    clientId: r.client_id,
    number: r.number,
    status: r.status,
    overdue,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    currency: r.currency,
    subtotal: r.subtotal,
    discountTotal: r.discount_total,
    taxTotal: r.tax_total,
    total: r.total,
    amountPaid: r.amount_paid,
    accountId: r.account_id,
    paymentAccountId: r.payment_account_id,
    notes: dec(r.notes),
    terms: dec(r.terms),
    publicToken: r.public_token,
    sentAt: r.sent_at,
    paidAt: r.paid_at,
    lines: lines && lines.length ? lines : undefined,
    paymentAccount: paymentAccount ?? undefined,
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
