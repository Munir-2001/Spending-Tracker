"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useEvents } from "@/components/events/events-provider";
import type { SpendEvent } from "@/lib/data";
import { attachCandidates } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cap the rendered list; search narrows it further. */
const MAX_ROWS = 200;

/** Pick existing expenses to group under an event. */
export function AttachExpensesDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: SpendEvent;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <AttachForm event={event} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AttachForm({ event, onDone }: { event: SpendEvent; onDone: () => void }) {
  const { items, assignEvent, getCategory, getAccount } = useAppData();
  const { getEvent } = useEvents();
  const dated = Boolean(event.startDate || event.endDate);
  const [withinDates, setWithinDates] = useState(dated);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const scope = withinDates ? event : { ...event, startDate: null, endDate: null };
    const q = query.trim().toLowerCase();
    return attachCandidates(scope, items).filter(
      (t) =>
        !q ||
        t.merchant.toLowerCase().includes(q) ||
        (getCategory(t.categoryId)?.label.toLowerCase().includes(q) ?? false)
    );
  }, [items, event, withinDates, query, getCategory]);
  const shown = candidates.slice(0, MAX_ROWS);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function attach() {
    if (picked.size === 0) return;
    setSaving(true);
    const ok = await assignEvent([...picked], event.id);
    setSaving(false);
    if (!ok) return;
    toast.success(`Added ${picked.size} expense${picked.size === 1 ? "" : "s"}`, {
      description: event.name,
    });
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="display text-xl">Add existing expenses</DialogTitle>
        <DialogDescription>
          Pick what belongs to {event.name}. Amounts, categories and accounts stay as they are.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-2 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search merchant or category"
            className="pl-9"
            autoFocus
          />
        </div>
        {dated && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={withinDates}
              onChange={(e) => setWithinDates(e.target.checked)}
              className="accent-primary"
            />
            Only show expenses within the event&apos;s dates
          </label>
        )}

        <div className="max-h-80 overflow-y-auto rounded-lg border border-border/60">
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No matching expenses.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {shown.map((t) => {
                const on = picked.has(t.id);
                const other = t.eventId ? getEvent(t.eventId) : undefined;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                        on && "bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.merchant}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatDate(t.date)} ·{" "}
                          {t.items?.length
                            ? `Split · ${t.items.length} items`
                            : getCategory(t.categoryId)?.label ?? "Uncategorized"}{" "}
                          · {getAccount(t.accountId)?.name ?? "—"}
                          {other && <> · moves from {other.name}</>}
                        </span>
                      </span>
                      <span className="num shrink-0 text-sm">
                        {formatMoney(t.amount, { currency: t.currency })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {candidates.length > shown.length && (
          <p className="text-xs text-muted-foreground">
            Showing the latest {MAX_ROWS} of {candidates.length} — search to narrow it down.
          </p>
        )}
      </div>

      <DialogFooter className="mt-4 gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" onClick={attach} disabled={saving || picked.size === 0}>
          {saving ? "Adding…" : picked.size ? `Add ${picked.size} to event` : "Add to event"}
        </Button>
      </DialogFooter>
    </>
  );
}
