"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ListPlus, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useEvents } from "@/components/events/events-provider";
import { EventDialog } from "@/components/events/event-dialog";
import { AttachExpensesDialog } from "@/components/events/attach-expenses-dialog";
import { EventExpenses } from "@/components/events/event-expenses";
import { BreakdownBars, DailyColumns } from "@/components/events/breakdown-bars";
import type { Transaction } from "@/lib/data";
import { eventDateLabel, summarizeEvent } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/format";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { getEvent, removeEvent } = useEvents();
  const { items, categories, accounts, fx, baseCurrency, openAddForEvent, assignEvent, forgetEvent } =
    useAppData();
  const [editOpen, setEditOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const event = getEvent(id);
  const summary = useMemo(
    () => (event ? summarizeEvent(event, items, categories, accounts, fx) : null),
    [event, items, categories, accounts, fx]
  );

  if (!event || !summary) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <EmptyState
          title="Event not found"
          description="It may have been deleted, or it belongs to another workspace."
          action={
            <Button asChild variant="outline">
              <Link href="/events">Back to events</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const fmt = (n: number) => formatMoney(n, { currency: baseCurrency, trimZeroCents: true });
  const dates = eventDateLabel(event);
  const count = summary.transactions.length;
  const over = summary.remaining != null && summary.remaining < 0;

  async function handleDelete() {
    if (!event) return;
    const ok = await confirm({
      title: `Delete ${event.name}?`,
      description:
        count > 0
          ? `Its ${count} expense${count === 1 ? "" : "s"} stay in your transactions — they're just no longer grouped.`
          : "This event has no expenses.",
      confirmText: "Delete event",
      tone: "danger",
    });
    if (!ok || !(await removeEvent(event.id))) return;
    forgetEvent(event.id);
    toast.success("Event deleted", { description: event.name });
    router.push("/events");
  }

  async function handleRemove(t: Transaction) {
    if (await assignEvent([t.id], null))
      toast.success("Removed from event", { description: t.merchant });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Events
        </Link>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: event.tint }} />
              <h1 className="display truncate text-3xl tracking-tight md:text-4xl">{event.name}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {dates && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {dates}
                </span>
              )}
              {event.notes && <span className="truncate">{event.notes}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openAddForEvent(event.id)} className="gap-1.5">
              <Plus className="size-4" />
              Add expense
            </Button>
            <Button variant="outline" onClick={() => setAttachOpen(true)} className="gap-1.5">
              <ListPlus className="size-4" />
              Add existing
            </Button>
            <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} aria-label="Edit event">
              <Pencil className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDelete} aria-label="Delete event">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Total spent" value={fmt(summary.spent)} accent />
          {summary.remaining != null ? (
            <StatTile
              label={over ? "Over budget" : "Budget left"}
              value={fmt(Math.abs(summary.remaining))}
              tone={over ? "expense" : "income"}
            />
          ) : (
            <StatTile label="Budget" value={<span className="text-muted-foreground">None</span>} />
          )}
          <StatTile
            label="Expenses"
            value={
              <>
                {count}
                {summary.days > 0 && (
                  <span className="ml-1.5 text-sm text-muted-foreground">
                    over {summary.days} day{summary.days === 1 ? "" : "s"}
                  </span>
                )}
              </>
            }
          />
          <StatTile
            label="Friends owe you"
            value={fmt(summary.owedToYou)}
            tone={summary.owedToYou > 0 ? "warning" : undefined}
          />
        </div>
      </Reveal>

      {count === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState
            className="mt-6"
            icon={<Receipt className="size-6" />}
            title="No expenses in this event yet"
            description="Record a new expense for it, or pick ones you've already logged."
            action={
              <div className="flex gap-2">
                <Button onClick={() => openAddForEvent(event.id)} className="gap-1.5">
                  <Plus className="size-4" />
                  Add expense
                </Button>
                <Button variant="outline" onClick={() => setAttachOpen(true)} className="gap-1.5">
                  <ListPlus className="size-4" />
                  Add existing
                </Button>
              </div>
            }
          />
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.08}>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard title="Where it went" bodyClassName="p-5">
                <BreakdownBars
                  slices={summary.byCategory}
                  total={summary.spent}
                  currency={baseCurrency}
                  empty="No spending yet."
                />
              </SectionCard>
              <SectionCard title="Paid from" bodyClassName="p-5">
                <BreakdownBars
                  slices={summary.byAccount}
                  total={summary.spent}
                  currency={baseCurrency}
                  empty="No spending yet."
                />
              </SectionCard>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <SectionCard
              className="mt-4"
              title="Spending by day"
              trailing={
                summary.biggest && (
                  <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                    Biggest: {summary.biggest.merchant} ·{" "}
                    {formatDate(summary.biggest.date)}
                  </span>
                )
              }
              bodyClassName="p-5"
            >
              <DailyColumns days={summary.byDay} currency={baseCurrency} tint={event.tint} />
            </SectionCard>
          </Reveal>

          <Reveal delay={0.12}>
            <SectionCard
              className="mt-4"
              title="Expenses"
              trailing={<span className="text-xs text-muted-foreground">{count}</span>}
            >
              <EventExpenses transactions={summary.transactions} onRemove={handleRemove} />
            </SectionCard>
          </Reveal>
        </>
      )}

      <EventDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={event}
        defaultCurrency={baseCurrency}
      />
      <AttachExpensesDialog open={attachOpen} onOpenChange={setAttachOpen} event={event} />
    </div>
  );
}
