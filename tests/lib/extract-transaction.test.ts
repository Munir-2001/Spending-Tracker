import { describe, it, expect } from "vitest";

import {
  buildExtractPrompt,
  parseExtractJson,
  type ExtractContext,
} from "@/lib/extract-transaction";

const ctx: ExtractContext = {
  categories: [
    { id: "c1", label: "Groceries" },
    { id: "c2", label: "Dining" },
  ],
  accounts: [
    { id: "a1", name: "Meezan", currency: "PKR" },
    { id: "a2", name: "Chase", currency: "USD" },
  ],
  baseCurrency: "USD",
  today: "2026-09-16",
};

describe("buildExtractPrompt", () => {
  it("includes the real category labels and account names", () => {
    const prompt = buildExtractPrompt("spent 100 at the shop", ctx);
    expect(prompt).toContain("Groceries");
    expect(prompt).toContain("Meezan");
  });

  it("anchors relative dates to the provided today", () => {
    const prompt = buildExtractPrompt("bought lunch yesterday", ctx);
    expect(prompt).toContain("2026-09-16");
  });

  it("names the base currency for the no-currency-mentioned case", () => {
    const prompt = buildExtractPrompt("paid 50", ctx);
    expect(prompt).toContain("USD");
  });

  it("caps an over-long transcript at 2000 chars", () => {
    const long = "a".repeat(5000);
    const prompt = buildExtractPrompt(long, ctx);
    // The transcript segment must not carry the full 5000 chars through.
    expect(prompt.length).toBeLessThan(5000);
  });
});

describe("parseExtractJson", () => {
  it("parses a well-formed multi-line object", () => {
    const parsed = parseExtractJson(
      JSON.stringify({
        merchant: "the grocery store",
        date: "2026-09-16",
        account: "Meezan",
        currency: "PKR",
        direction: "expense",
        lines: [
          { description: "vegetables", category: "Groceries", amount: 1200 },
          { description: "meat", category: "Groceries", amount: 2000 },
        ],
      })
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe("the grocery store");
    expect(parsed?.currency).toBe("PKR");
    expect(parsed?.lines).toHaveLength(2);
    expect(parsed?.lines[0].amount).toBe(1200);
  });

  it("strips a ```json code fence before parsing", () => {
    const parsed = parseExtractJson(
      '```json\n{"merchant":"x","date":"2026-09-16","account":null,"currency":"usd","direction":"expense","lines":[{"description":"a","category":"Dining","amount":10}]}\n```'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.currency).toBe("USD"); // upper-cased
    expect(parsed?.account).toBeNull();
  });

  it("returns null for non-JSON text", () => {
    expect(parseExtractJson("sorry, I can't do that")).toBeNull();
  });

  it("returns null when there are no valid lines", () => {
    const parsed = parseExtractJson(
      JSON.stringify({
        merchant: "x",
        date: "2026-09-16",
        account: null,
        currency: "USD",
        direction: "expense",
        lines: [{ description: "a", category: "Dining", amount: 0 }],
      })
    );
    expect(parsed).toBeNull();
  });

  it("drops negative/invalid line amounts and normalizes the rest to positive", () => {
    const parsed = parseExtractJson(
      JSON.stringify({
        merchant: "x",
        date: "2026-09-16",
        account: null,
        currency: "USD",
        direction: "expense",
        lines: [
          { description: "keep", category: "Dining", amount: -15 },
          { description: "skip", category: "Dining", amount: "nope" },
        ],
      })
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.lines).toHaveLength(1);
    expect(parsed?.lines[0].amount).toBe(15);
  });

  it("defaults an unknown direction to expense", () => {
    const parsed = parseExtractJson(
      JSON.stringify({
        merchant: "x",
        date: "2026-09-16",
        account: null,
        currency: "USD",
        direction: "sideways",
        lines: [{ description: "a", category: "Dining", amount: 10 }],
      })
    );
    expect(parsed?.direction).toBe("expense");
  });
});
