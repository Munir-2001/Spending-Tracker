import { z } from "zod";

/**
 * Server-side input validation + sanitization (defense in depth). Every mutating
 * server action parses its input through one of these schemas before touching
 * the database. This trims/caps strings, enforces enums & formats, rejects
 * non-integer money, and — importantly — restricts category colors to a safe
 * CSS-token allowlist so a crafted value can't inject CSS (XSS).
 */

const reqStr = (max: number) => z.string().trim().min(1).max(max);
const optStr = (max: number) => z.string().trim().max(max).nullable();
const idStr = z.string().trim().min(1).max(64);

// 3-letter currency code, case-insensitive, normalized to uppercase.
const currency = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{3}$/)
  .transform((s) => s.toUpperCase());

// Money is integer minor units only — blocks NaN/Infinity/floats.
const intAmount = z.number().int();

// ISO yyyy-mm-dd.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Safe CSS color: hex, var(--token), oklch()/hsl()/rgb()/rgba() — and nothing
// else (no semicolons, no url(), no expression(), no injection).
const colorStr = z
  .string()
  .trim()
  .max(64)
  .regex(
    /^(#[0-9a-fA-F]{3,8}|var\(--[a-zA-Z0-9-]+\)|oklch\([0-9.\s%/-]+\)|hsl\([0-9.,\s%]+\)|rgba?\([0-9.,\s%]+\))$/
  );

const subtype = z.enum([
  "checking",
  "savings",
  "credit_card",
  "cash",
  "loan",
  "investment",
  "other",
]);

export const accountInput = z.object({
  name: reqStr(120),
  type: z.enum(["asset", "liability"]),
  subtype: subtype.nullable(),
  currency,
  institution: optStr(120),
  accountNumber: optStr(64),
  swift: z.string().trim().max(20).nullable().optional(),
  iban: z.string().trim().max(64).nullable().optional(),
  branch: z.string().trim().max(120).nullable().optional(),
  openingBalance: intAmount,
  parentId: idStr.nullable(),
  isGroup: z.boolean(),
});

const lineInput = z.object({
  // May be "" for an uncategorized line (buildLines maps "" → null). Must match
  // the parent's tolerance, otherwise editing a split with an uncategorized item
  // throws a ZodError and the save silently fails.
  categoryId: z.string().trim().max(64),
  description: z.string().trim().max(200),
  amount: intAmount,
  reimbursable: z.boolean().optional(),
});

export const transactionInput = z.object({
  merchant: reqStr(200),
  amount: intAmount,
  categoryId: z.string().trim().max(64), // may be "" for split / income
  accountId: idStr,
  currency,
  date: isoDate,
  items: z.array(lineInput).max(100).optional(),
  notIncome: z.boolean().optional(),
  reimbursement: z
    .object({
      person: z.string().trim().max(120),
      amount: z.number().int().nonnegative(),
      note: z.string().trim().max(500),
    })
    .optional(),
});

export const assetInput = z.object({
  name: reqStr(120),
  type: z.enum([
    "property",
    "vehicle",
    "crypto",
    "gold",
    "investment",
    "cash",
    "valuable",
    "other",
  ]),
  value: intAmount,
  currency,
  note: z.string().trim().max(500).nullable(),
  // Market-priced — "XAU" for gold, or a CoinGecko coin id for crypto.
  symbol: z.string().trim().max(40).nullable().optional(),
  quantity: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, "quantity must be > 0")
    .nullable()
    .optional(),
  unit: z.enum(["tola", "gram", "gram10", "ozt"]).nullable().optional(),
  karat: z.number().int().min(1).max(24).nullable().optional(),
  costBasis: intAmount.nonnegative().nullable().optional(),
  // First purchase's itemized cost, so a new gold asset seeds its first lot.
  firstLot: z
    .object({
      date: isoDate,
      goldCost: intAmount.nonnegative(),
      commission: intAmount.nonnegative(),
      tax: intAmount.nonnegative(),
    })
    .optional(),
});

const metalUnit = z.enum(["tola", "gram", "gram10", "ozt"]);
const positiveQty = z
  .number()
  .refine((n) => Number.isFinite(n) && n > 0, "quantity must be > 0");

export const assetLotInput = z.object({
  assetId: idStr,
  date: isoDate,
  quantity: positiveQty,
  unit: metalUnit.nullable(), // null for crypto
  karat: z.number().int().min(1).max(24).nullable(),
  goldCost: intAmount.nonnegative(),
  commission: intAmount.nonnegative(),
  tax: intAmount.nonnegative(),
  currency,
  note: z.string().trim().max(500).nullable().optional(),
});

export const categoryInput = z.object({
  name: reqStr(60),
  kind: z.enum(["income", "expense"]),
  color: colorStr,
  parentId: idStr.nullable(),
});

export const transferInput = z.object({
  fromKind: z.enum(["account", "asset"]),
  fromId: idStr,
  toKind: z.enum(["account", "asset"]),
  toId: idStr,
  amount: z.number().int().positive(),
  toAmount: z.number().int().positive(),
  date: isoDate,
  note: z.string().trim().max(200),
});

export const repaymentInput = z.object({
  claimId: idStr,
  accountId: idStr,
  amount: intAmount,
  currency,
  date: isoDate,
});

export const importRows = z
  .array(
    z.object({
      date: isoDate,
      description: z.string().trim().max(200),
      amount: intAmount,
    })
  )
  .max(5000);

// Which optional sections/columns show on an invoice (all fields optional; the
// server normalizes missing ones to the default). Shared by settings + invoices.
const invoiceFieldPrefs = z
  .object({
    quantity: z.boolean(),
    tax: z.boolean(),
    discount: z.boolean(),
    paymentDetails: z.boolean(),
    notes: z.boolean(),
    terms: z.boolean(),
  })
  .partial();

export const settingsInput = z.object({
  baseCurrency: currency,
  rates: z
    .record(
      z.string().trim().max(8),
      z.number().refine((n) => Number.isFinite(n) && n > 0, "rate must be > 0")
    )
    .refine((r) => Object.keys(r).length <= 100, "too many rate entries"),
  defaultAccountId: idStr.nullable().optional(),
  invoicePrefs: invoiceFieldPrefs.optional(),
});

export const goalInput = z.object({
  name: reqStr(80),
  target: z.number().int().positive(),
  saved: z.number().int().nonnegative(),
  currency,
  targetDate: isoDate.nullable(),
  color: colorStr,
});

export const recurringInput = z.object({
  merchant: reqStr(200),
  amount: intAmount.refine((n) => n !== 0, "amount is required"),
  categoryId: z.string().trim().max(64),
  accountId: idStr,
  currency,
  cadence: z.enum(["weekly", "monthly", "yearly"]),
  nextDate: isoDate,
  autoPost: z.boolean(),
});

// A signed integer delta for adjusting a goal's saved amount.
export const goalContribution = z.number().int();

export const feedbackInput = z.object({
  message: reqStr(4000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  page: z.string().trim().max(120).nullable().optional(),
});

// ── Invoicing ────────────────────────────────────────────────────────────────

export const clientInput = z.object({
  name: reqStr(120),
  email: z.string().trim().max(200).nullable(),
  phone: z.string().trim().max(40).nullable(),
  address: z.string().trim().max(500).nullable(),
  taxId: z.string().trim().max(60).nullable(),
  currency,
  notes: z.string().trim().max(1000).nullable(),
});

const invoiceLineInput = z.object({
  description: reqStr(300),
  // Fractional quantities allowed (hours/units); must be finite and > 0.
  quantity: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, "quantity must be > 0"),
  unitPrice: intAmount, // signed allowed (credits), typically >= 0
  taxRate: z
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100, "tax 0–100")
    .nullable()
    .optional(),
});

export const invoiceInput = z.object({
  clientId: idStr,
  issueDate: isoDate,
  dueDate: isoDate,
  currency,
  discountTotal: intAmount.nonnegative().optional(),
  accountId: idStr.nullable().optional(),
  paymentAccountId: idStr.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  terms: z.string().trim().max(2000).nullable().optional(),
  fieldPrefs: invoiceFieldPrefs.optional(),
  lines: z.array(invoiceLineInput).min(1).max(200),
});

export const paymentAccountInput = z.object({
  label: reqStr(120), // may be prefilled from an account title (also 120)
  accountName: reqStr(120),
  bankName: z.string().trim().max(120).nullable(),
  accountNumber: z.string().trim().max(64).nullable(),
  iban: z.string().trim().max(64).nullable(),
  swift: z.string().trim().max(20).nullable(),
  // Branch can be a full name/address (matches accounts.branch), not a short code.
  branchCode: z.string().trim().max(120).nullable(),
  currency,
  notes: z.string().trim().max(1000).nullable(),
  isDefault: z.boolean(),
});

export const invoicePaymentInput = z.object({
  invoiceId: idStr,
  accountId: idStr,
  amount: z.number().int().positive(),
  date: isoDate,
});

export const idInput = idStr;
export const categoryIdInput = z.string().trim().max(64);
