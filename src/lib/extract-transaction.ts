/**
 * Shared (server + client) helpers for turning a spoken/typed sentence into a
 * structured, itemized transaction draft. Pure — no I/O, no framework imports —
 * so the same prompt and JSON guard run on the parse route (server) and in the
 * client fallback path.
 *
 * The model NEVER writes to the ledger. Its job is only to propose a `ParsedTx`
 * that the user reviews and edits before approving. Amounts here are POSITIVE
 * MAJOR units (what a person says out loud); the review card converts them to
 * signed minor units at approve time via `toMinorUnits`.
 */

/** A single proposed line item — one category's slice of the spend. */
export type ParsedLine = {
  description: string;
  /** A category LABEL (not id). Resolved to a real id in the review card. */
  category: string;
  /** Positive amount in MAJOR units of the transaction currency. */
  amount: number;
};

/** The model's proposed transaction, before the user reviews/edits it. */
export type ParsedTx = {
  merchant: string;
  /** yyyy-mm-dd, resolved against `ExtractContext.today`. */
  date: string;
  /** An account NAME (not id), or null when none was mentioned. */
  account: string | null;
  currency: string;
  direction: "expense" | "income";
  lines: ParsedLine[];
};

/** The user's real categories/accounts, given to the model so it stays grounded. */
export type ExtractContext = {
  categories: { id: string; label: string }[];
  accounts: { id: string; name: string; currency: string }[];
  baseCurrency: string;
  /** yyyy-mm-dd — "today" for resolving relative dates. */
  today: string;
};

const MAX_TRANSCRIPT = 2000;

/**
 * Build the instruction prompt. The model is told to emit ONLY a JSON object
 * matching `ParsedTx`, choosing from the user's real category labels and account
 * names so downstream resolution is a lookup, not a guess.
 */
export function buildExtractPrompt(
  transcript: string,
  ctx: ExtractContext
): string {
  const clean = transcript.slice(0, MAX_TRANSCRIPT).trim();
  const categoryLabels = ctx.categories.map((c) => c.label);
  const accountNames = ctx.accounts.map((a) => a.name);

  return [
    "You extract a single financial transaction from a short sentence a user spoke or typed.",
    "Return ONLY a JSON object — no prose, no markdown, no code fences.",
    "",
    "The JSON object MUST have exactly this shape:",
    "{",
    '  "merchant": string,            // where the money went/came from, e.g. "the grocery store"',
    '  "date": string,                // yyyy-mm-dd',
    '  "account": string | null,      // MUST be one of the account names below, or null',
    '  "currency": string,            // 3-letter ISO code',
    '  "direction": "expense" | "income",',
    '  "lines": [                     // one or more line items',
    "    {",
    '      "description": string,',
    '      "category": string,        // MUST be one of the category labels below',
    '      "amount": number           // POSITIVE, in major units of the currency',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    `- Each line "category" MUST be exactly one of these labels (pick the best match): ${JSON.stringify(
      categoryLabels
    )}. If nothing fits, use "Uncategorized".`,
    `- "account" MUST be exactly one of these account names, or null if none is mentioned: ${JSON.stringify(
      accountNames
    )}.`,
    "- Amounts are POSITIVE numbers in the transaction currency's major units (e.g. dollars, rupees), never negative, never minor units (cents/paisa).",
    "- If the sentence breaks the spend into parts (e.g. \"1200 vegetables, 2000 meat\"), produce one line per part. Otherwise produce a single line for the whole amount.",
    "- The line amounts should sum to the stated total. If a total is given but the parts don't add up, keep the parts as spoken.",
    "- Infer currency from words/symbols: rupees/rs/₨ → PKR, €/euro → EUR, $/dollar → USD, £/pound → GBP, dirham/aed → AED. " +
      `If no currency is mentioned, use ${ctx.baseCurrency}.`,
    `- Resolve relative dates against today = ${ctx.today} (yyyy-mm-dd). "today" → ${ctx.today}; "yesterday" → the day before; a bare weekday/month/day → the most recent matching past date. If no date is mentioned, use ${ctx.today}.`,
    "- direction is \"income\" only for money received (salary, refund, payment received); otherwise \"expense\".",
    "",
    "Sentence:",
    clean,
  ].join("\n");
}

/** Strip a ```json … ``` (or bare ```) fence if the model wrapped its output. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Safely parse and shape-guard the model's text into a `ParsedTx`. Returns null
 * on any deviation (bad JSON, missing fields, wrong types) — the caller then
 * falls back rather than trusting a malformed shape.
 */
export function parseExtractJson(text: string): ParsedTx | null {
  if (!text || typeof text !== "string") return null;

  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFences(text));
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const merchant = typeof obj.merchant === "string" ? obj.merchant.trim() : "";
  const date = typeof obj.date === "string" ? obj.date.trim() : "";
  const currency =
    typeof obj.currency === "string" && obj.currency.trim()
      ? obj.currency.trim().toUpperCase()
      : "";
  const direction =
    obj.direction === "income" || obj.direction === "expense"
      ? obj.direction
      : "expense";
  const account =
    typeof obj.account === "string" && obj.account.trim()
      ? obj.account.trim()
      : null;

  if (!currency || !Array.isArray(obj.lines)) return null;

  const lines: ParsedLine[] = [];
  for (const entry of obj.lines) {
    if (typeof entry !== "object" || entry === null) continue;
    const line = entry as Record<string, unknown>;
    if (!isFiniteNumber(line.amount)) continue;
    const amount = Math.abs(line.amount);
    if (amount <= 0) continue;
    lines.push({
      description:
        typeof line.description === "string" ? line.description.trim() : "",
      category: typeof line.category === "string" ? line.category.trim() : "",
      amount,
    });
  }

  if (lines.length === 0) return null;

  return { merchant, date, account, currency, direction, lines };
}
