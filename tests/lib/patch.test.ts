import { describe, it, expect } from "vitest";

import { keepIfEmpty } from "@/lib/patch";

describe("keepIfEmpty (non-destructive update guard)", () => {
  it("drops null, undefined and empty-string values", () => {
    expect(
      keepIfEmpty({ a: null, b: undefined, c: "", d: "keep" })
    ).toEqual({ d: "keep" });
  });

  it("keeps real values so provided fields still update", () => {
    expect(
      keepIfEmpty({ account_number: "enc1:abc", iban: "enc1:def" })
    ).toEqual({ account_number: "enc1:abc", iban: "enc1:def" });
  });

  it("merged after a base patch, a blank field preserves the stored value", () => {
    // Simulates updateAccount: base is always written; optional bank text is
    // pruned when empty, so the DB keeps whatever it already had.
    const base = { name: "enc1:name", currency: "USD" };
    const patch = {
      ...base,
      ...keepIfEmpty({ account_number: null, iban: "enc1:new" }),
    };
    // account_number is NOT in the patch → partial UPDATE leaves it untouched.
    expect("account_number" in patch).toBe(false);
    expect(patch).toEqual({
      name: "enc1:name",
      currency: "USD",
      iban: "enc1:new",
    });
  });

  it("does NOT prune 0 or false — only route optional text through it", () => {
    // Guardrail: numbers/booleans must never be passed here, but if they are,
    // 0 and false are meaningful and must survive.
    expect(keepIfEmpty({ n: 0, b: false })).toEqual({ n: 0, b: false });
  });
});
