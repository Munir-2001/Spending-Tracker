"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, PartyPopper, Plus } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useEvents } from "@/components/events/events-provider";
import { EventDialog } from "@/components/events/event-dialog";
import type { SpendEvent } from "@/lib/data";
import {
  eventDateLabel,
  eventStatus,
  summarizeEvent,
  type EventStatus,
  type EventSummary,
} from "@/lib/events";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_ORDER: Record<EventStatus, number> = { ongoing: 0, upcoming: 1, undated: 2, past: 3 };
const STATUS_LABEL: Record<EventStatus, string> = {
  ongoing: "Happening now",
  upcoming: "Upcoming",
  undated: "No dates",
  past: "Finished",
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function EventsPage() {
  const router = useRouter();
  const { events } = useEvents();
  const { items, categories, accounts, fx, baseCurrency } = useAppData();
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const today = localToday();
    return events
      .map((event) => ({
        event,
        status: eventStatus(event, today),
        summary: summarizeEvent(event, items, categories, accounts, fx),
      }))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (b.event.startDate ?? "").localeCompare(a.event.startDate ?? "") ||
          a.event.name.localeCompare(b.event.name)
      );
  }, [events, items, categories, accounts, fx]);

  const totalSpent = rows.reduce((s, r) => s + r.summary.spent, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.summary.transactions.length, 0);
  const fmt = (n: number) => formatMoney(n, { currency: baseCurrency, trimZeroCents: true });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">Events</h1>
            <p className="text-sm text-muted-foreground">
              Group the expenses of a trip, a wedding or a project and see what the whole
              thing cost.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0 gap-1.5">
            <Plus className="size-4" />
            New event
          </Button>
        </div>
      </Reveal>

      {rows.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            className="mt-10"
            icon={<PartyPopper className="size-6" />}
            title="No events yet"
            description="Create one — say “Lahore trip” — then add expenses to it from the event page or straight from the expense form."
            action={
              <Button onClick={() => setOpen(true)} variant="outline" className="gap-1.5">
                <Plus className="size-4" />
                New event
              </Button>
            }
          />
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.04}>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Spent across events" value={fmt(totalSpent)} accent />
              <StatTile label="Events" value={rows.length} />
              <StatTile label="Expenses grouped" value={totalExpenses} />
            </div>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map((r, i) => (
              <Reveal key={r.event.id} delay={0.06 + i * 0.03}>
                <EventCard
                  event={r.event}
                  status={r.status}
                  summary={r.summary}
                  currency={baseCurrency}
                />
              </Reveal>
            ))}
          </div>
        </>
      )}

      <EventDialog
        open={open}
        onOpenChange={setOpen}
        editing={null}
        defaultCurrency={baseCurrency}
        onCreated={(e) => router.push(`/events/${e.id}`)}
      />
    </div>
  );
}

function EventCard({
  event,
  status,
  summary,
  currency,
}: {
  event: SpendEvent;
  status: EventStatus;
  summary: EventSummary;
  currency: string;
}) {
  const fmt = (n: number) => formatMoney(n, { currency, trimZeroCents: true });
  const dates = eventDateLabel(event);
  const pct =
    summary.budget && summary.budget > 0 ? Math.min(100, (summary.spent / summary.budget) * 100) : null;
  const over = summary.remaining != null && summary.remaining < 0;
  const count = summary.transactions.length;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: event.tint }} />
          <p className="truncate font-medium">{event.name}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            status === "ongoing" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {dates && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {dates}
        </p>
      )}

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="num text-2xl font-medium tabular-nums">{fmt(summary.spent)}</span>
        {summary.budget != null && (
          <span className="text-sm text-muted-foreground">of {fmt(summary.budget)}</span>
        )}
      </div>

      {pct != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(pct, 2)}%`,
              backgroundColor: over ? "var(--expense)" : event.tint,
            }}
          />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
        <span>
          {count} expense{count === 1 ? "" : "s"}
          {summary.byCategory[0] && <> · mostly {summary.byCategory[0].label}</>}
        </span>
        {summary.remaining != null && (
          <span className={cn("num", over ? "text-expense" : "")}>
            {over ? `${fmt(-summary.remaining)} over` : `${fmt(summary.remaining)} left`}
          </span>
        )}
      </div>
    </Link>
  );
}
