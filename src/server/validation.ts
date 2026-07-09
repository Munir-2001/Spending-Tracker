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
  openingBalance: intAmount,
  parentId: idStr.nullable(),
  isGroup: z.boolean(),
});

const lineInput = z.object({
  categoryId: idStr,
  description: z.string().trim().max(200),
  amount: intAmount,
});

export const transactionInput = z.object({
  merchant: reqStr(200),
  amount: intAmount,
  categoryId: z.string().trim().max(64), // may be "" for split / income
  accountId: idStr,
  currency,
  date: isoDate,
  items: z.array(lineInput).max(100).optional(),
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
  // Market-priced (gold) — optional.
  symbol: z.enum(["XAU"]).nullable().optional(),
  quantity: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, "quantity must be > 0")
    .nullable()
    .optional(),
  unit: z.enum(["tola", "gram", "gram10", "ozt"]).nullable().optional(),
  karat: z.number().int().min(1).max(24).nullable().optional(),
  costBasis: intAmount.nonnegative().nullable().optional(),
});

export const categoryInput = z.object({
  name: reqStr(60),
  kind: z.enum(["income", "expense"]),
  color: colorStr,
  parentId: idStr.nullable(),
});

export const transferInput = z.object({
  fromAccountId: idStr,
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

export const settingsInput = z.object({
  baseCurrency: currency,
  rates: z.record(
    z.string().trim().max(8),
    z.number().refine((n) => Number.isFinite(n) && n > 0, "rate must be > 0")
  ),
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

export const idInput = idStr;
export const categoryIdInput = z.string().trim().max(64);
