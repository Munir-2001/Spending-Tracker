/**
 * Event roll-ups: everything the Events pages show about a group of expenses,
 * in the base currency. Pure functions over the provider's state.
 *
 * Spending follows the same rules as the rest of the app (see spendMagnitude /
 * spendingByCategoryBase): transfers, refunds and money owed back by friends
 * are not your spending.
 */

import type { Account, Category, SpendEvent, Transaction } from "@/lib/data";
import type { Fx } from "@/lib/currency";
import { categoryLinesOf, rollupCategoryId, spendMagnitude } from "@/lib/compute";

export type EventSlice = { id: string; label: string; tint: string; amount: number };

export type EventSummary = {
  transactions: Transaction[]; // newest first
  spent: number; // base minor units, ≥0
  /** Still owed back by friends for expenses in this event (base, ≥0). */
  owedToYou: number;
  budget: number | null; // base minor units
  remaining: number | null; // budget − spent (may be negative)
  firstDate: string | null;
  lastDate: string | null;
  days: number; // distinct days with spending
  byCategory: EventSlice[]; // desc
  byAccount: EventSlice[]; // desc — where the money came from
  byDay: { date: string; amount: number }[]; // ascending, spending days only
  biggest: Transaction | null;
};

/** Transactions grouped under the event, newest first. */
export function eventTransactions(eventId: string, transactions: Transaction[]): Transaction[] {
  return transactions
    .filter((t) => t.eventId === eventId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Your own spend per category line (owed-back parts removed), base currency. */
function ownCategoryLines(t: Transaction, fx: Fx): { categoryId: string; amount: number }[] {
  if (t.isReimbursement || t.isTransfer || t.notIncome) return [];
  const split = Boolean(t.items?.length);
  const out: { categoryId: string; amount: number }[] = [];
  for (const line of categoryLinesOf(t)) {
    if (split && line.reimbursable) continue;
    const own = t.reimbursement && !split ? line.amount + t.reimbursement.amount : line.amount;
    if (own >= 0) continue;
    out.push({ categoryId: line.categoryId, amount: -fx.toBase(own, t.currency) });
  }
  return out;
}

function addTo(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function slices(
  totals: Map<string, number>,
  describe: (id: string) => { label: string; tint: string }
): EventSlice[] {
  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ id, amount, ...describe(id) }))
    .sort((a, b) => b.amount - a.amount);
}

export function summarizeEvent(
  event: SpendEvent,
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  fx: Fx
): EventSummary {
  const txns = eventTransactions(event.id, transactions);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const accById = new Map(accounts.map((a) => [a.id, a]));

  const byCategory = new Map<string, number>();
  const byAccount = new Map<string, number>();
  const byDay = new Map<string, number>();
  let spent = 0;
  let owedToYou = 0;
  let biggest: Transaction | null = null;
  let biggestAmount = 0;

  for (const t of txns) {
    const amount = spendMagnitude(t, fx);
    if (t.reimbursement && !t.reimbursement.settled)
      owedToYou += Math.abs(fx.toBase(t.reimbursement.amount, t.currency));
    if (amount <= 0) continue;
    spent += amount;
    addTo(byAccount, t.accountId, amount);
    addTo(byDay, t.date, amount);
    for (const line of ownCategoryLines(t, fx))
      addTo(byCategory, rollupCategoryId(line.categoryId, catById), line.amount);
    if (amount > biggestAmount) {
      biggest = t;
      biggestAmount = amount;
    }
  }

  const budget = event.budget != null ? fx.toBase(event.budget, event.currency) : null;
  const dates = txns.map((t) => t.date).sort();

  return {
    transactions: txns,
    spent,
    owedToYou,
    budget,
    remaining: budget != null ? budget - spent : null,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    days: byDay.size,
    byCategory: slices(byCategory, (id) => {
      const c = catById.get(id);
      return { label: c?.label ?? "Uncategorized", tint: c?.tint ?? "var(--muted-foreground)" };
    }),
    byAccount: slices(byAccount, (id) => ({
      label: accById.get(id)?.name ?? "Unknown account",
      tint: "var(--chart-2)",
    })),
    byDay: [...byDay.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    biggest,
  };
}

export type EventStatus = "upcoming" | "ongoing" | "past" | "undated";

/** Where the event sits relative to `today` (yyyy-mm-dd), from its own dates. */
export function eventStatus(event: SpendEvent, today: string): EventStatus {
  const { startDate, endDate } = event;
  if (!startDate && !endDate) return "undated";
  if (startDate && today < startDate) return "upcoming";
  if (endDate && today > endDate) return "past";
  return "ongoing";
}

/**
 * Expenses worth suggesting for an event: not already in it, not transfers or
 * refunds, outflows only, and inside the event's dates when it has them.
 */
export function attachCandidates(event: SpendEvent, transactions: Transaction[]): Transaction[] {
  return transactions
    .filter(
      (t) =>
        t.eventId !== event.id &&
        t.amount < 0 &&
        !t.isTransfer &&
        !t.isReimbursement &&
        (!event.startDate || t.date >= event.startDate) &&
        (!event.endDate || t.date <= event.endDate)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

const SHORT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const LONG = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });
const at = (iso: string) => new Date(`${iso}T00:00:00`);

/** "3 – 10 Oct 2026"-style label from the event's own dates, or null if undated. */
export function eventDateLabel(event: Pick<SpendEvent, "startDate" | "endDate">): string | null {
  const { startDate, endDate } = event;
  if (!startDate && !endDate) return null;
  if (!startDate) return `Until ${LONG.format(at(endDate!))}`;
  if (!endDate || endDate === startDate)
    return endDate ? LONG.format(at(startDate)) : `From ${LONG.format(at(startDate))}`;
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  return `${(sameYear ? SHORT : LONG).format(at(startDate))} – ${LONG.format(at(endDate))}`;
}
