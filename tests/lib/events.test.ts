import { describe, it, expect } from "vitest";

import { attachCandidates, eventDateLabel, eventStatus, summarizeEvent } from "@/lib/events";
import { makeFx, DEFAULT_RATES } from "@/lib/currency";
import type { Account, Category, SpendEvent, Transaction } from "@/lib/data";

// 1 EUR = 1 USD-unit and 1 PKR = 0.004 → 1 EUR = 250 PKR, so conversions are exact.
const fx = makeFx("EUR", { ...DEFAULT_RATES, EUR: 1, PKR: 0.004 });

const categories: Category[] = [
  { id: "c_travel", label: "Travel", kind: "expense", tint: "var(--cat-1)", parentId: null },
  { id: "c_flights", label: "Flights", kind: "expense", tint: "var(--cat-2)", parentId: "c_travel" },
  { id: "c_food", label: "Food", kind: "expense", tint: "var(--cat-3)", parentId: null },
];
const accounts: Account[] = [
  { id: "a_card", name: "Revolut", currency: "EUR" } as Account,
  { id: "a_meezan", name: "Meezan", currency: "PKR" } as Account,
];

const trip: SpendEvent = {
  id: "e_trip",
  name: "Lahore trip",
  startDate: "2026-10-01",
  endDate: "2026-10-10",
  budget: 100000, // €1,000
  currency: "EUR",
  tint: "var(--cat-1)",
  notes: null,
};

const txn = (over: Partial<Transaction> & Pick<Transaction, "id">): Transaction => ({
  date: "2026-10-02",
  merchant: "x",
  categoryId: "c_food",
  accountId: "a_card",
  amount: -1000,
  currency: "EUR",
  eventId: "e_trip",
  ...over,
});

const flight = txn({ id: "t_flight", categoryId: "c_flights", amount: -40000, date: "2026-10-01" });
// 25,000 PKR dinner (PKR has no minor unit) = €100, paid from Meezan.
const dinner = txn({ id: "t_dinner", amount: -25000, currency: "PKR", accountId: "a_meezan" });
// €60 split: €20 food is mine, €40 gift tagged for a friend.
const market = txn({
  id: "t_market",
  amount: -6000,
  categoryId: "",
  date: "2026-10-03",
  items: [
    { id: "i1", categoryId: "c_food", description: "Snacks", amount: -2000 },
    { id: "i2", categoryId: "c_travel", description: "Gift", amount: -4000, reimbursable: true },
  ],
  reimbursement: { person: "Ali", amount: 4000, note: "", settled: false, settledAt: null },
});
const transferIn = txn({ id: "t_transfer", amount: -50000, isTransfer: true });
const otherEvent = txn({ id: "t_other", eventId: "e_other", amount: -99900 });
const unlinked = txn({ id: "t_unlinked", eventId: null, date: "2026-10-05" });

const all = [flight, dinner, market, transferIn, otherEvent, unlinked];

describe("summarizeEvent", () => {
  const s = summarizeEvent(trip, all, categories, accounts, fx);

  it("totals only this event's real spending, in the base currency", () => {
    // €400 flight + €100 dinner + €20 own share of the market run
    expect(s.spent).toBe(52000);
    expect(s.transactions.map((t) => t.id)).toEqual([
      "t_market",
      "t_transfer", // same day as dinner → id tie-break, newest-first
      "t_dinner",
      "t_flight",
    ]);
  });

  it("ignores transfers and nets out what friends owe back", () => {
    expect(s.owedToYou).toBe(4000);
    expect(s.byCategory.find((c) => c.id === "c_travel")?.amount).toBe(40000); // flight only
  });

  it("rolls sub-categories into their parent, largest first", () => {
    expect(s.byCategory.map((c) => [c.label, c.amount])).toEqual([
      ["Travel", 40000],
      ["Food", 12000],
    ]);
  });

  it("breaks spending down by paying account", () => {
    expect(s.byAccount.map((a) => [a.label, a.amount])).toEqual([
      ["Revolut", 42000],
      ["Meezan", 10000],
    ]);
  });

  it("tracks budget, remaining, days and the biggest expense", () => {
    expect(s.budget).toBe(100000);
    expect(s.remaining).toBe(48000);
    expect(s.days).toBe(3);
    expect(s.byDay.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(s.biggest?.id).toBe("t_flight");
  });

  it("is empty but well-formed for an event with no expenses", () => {
    const empty = summarizeEvent({ ...trip, id: "e_none", budget: null }, all, categories, accounts, fx);
    expect(empty.spent).toBe(0);
    expect(empty.remaining).toBeNull();
    expect(empty.firstDate).toBeNull();
    expect(empty.biggest).toBeNull();
  });
});

describe("eventStatus", () => {
  it("places the event relative to today", () => {
    expect(eventStatus(trip, "2026-09-30")).toBe("upcoming");
    expect(eventStatus(trip, "2026-10-05")).toBe("ongoing");
    expect(eventStatus(trip, "2026-10-11")).toBe("past");
    expect(eventStatus({ ...trip, startDate: null, endDate: null }, "2026-10-05")).toBe("undated");
  });
});

describe("attachCandidates", () => {
  it("suggests unlinked expenses within the event's dates, excluding transfers", () => {
    const outside = txn({ id: "t_outside", eventId: null, date: "2026-11-01" });
    const income = txn({ id: "t_income", eventId: null, amount: 5000 });
    const ids = attachCandidates(trip, [...all, outside, income]).map((t) => t.id);
    expect(ids).toEqual(["t_unlinked", "t_other"]);
  });
});

describe("eventDateLabel", () => {
  it("formats ranges, single days and open-ended events", () => {
    expect(eventDateLabel(trip)).toBe("Oct 1 – Oct 10, 2026");
    expect(eventDateLabel({ startDate: "2026-12-30", endDate: "2027-01-02" })).toBe(
      "Dec 30, 2026 – Jan 2, 2027"
    );
    expect(eventDateLabel({ startDate: "2026-10-01", endDate: "2026-10-01" })).toBe("Oct 1, 2026");
    expect(eventDateLabel({ startDate: "2026-10-01", endDate: null })).toBe("From Oct 1, 2026");
    expect(eventDateLabel({ startDate: null, endDate: "2026-10-01" })).toBe("Until Oct 1, 2026");
    expect(eventDateLabel({ startDate: null, endDate: null })).toBeNull();
  });
});
