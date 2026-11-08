"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEvents } from "@/components/events/events-provider";
import type { SpendEvent } from "@/lib/data";
import type { NewEventInput } from "@/lib/schema";
import { CURRENCIES, currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const EVENT_PALETTE = [
  "var(--cat-1)",
  "var(--cat-3)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-8)",
  "var(--cat-10)",
];

/** Create or edit an event. `onCreated` receives the new event (e.g. to open it). */
export function EventDialog({
  open,
  onOpenChange,
  editing,
  defaultCurrency,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SpendEvent | null;
  defaultCurrency: string;
  onCreated?: (event: SpendEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so each open starts from the event being edited (or blank). */}
        {open && (
          <EventForm
            key={editing?.id ?? "new"}
            editing={editing}
            defaultCurrency={defaultCurrency}
            onDone={() => onOpenChange(false)}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  editing,
  defaultCurrency,
  onDone,
  onCreated,
}: {
  editing: SpendEvent | null;
  defaultCurrency: string;
  onDone: () => void;
  onCreated?: (event: SpendEvent) => void;
}) {
  const { createEvent, editEvent } = useEvents();
  const [name, setName] = useState(editing?.name ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [currency, setCurrency] = useState(editing?.currency ?? defaultCurrency);
  const [budget, setBudget] = useState(
    editing?.budget != null ? String(toMajorUnits(editing.budget, editing.currency)) : ""
  );
  const [color, setColor] = useState(editing?.tint ?? EVENT_PALETTE[0]);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the event a name.");
    if (startDate && endDate && endDate < startDate)
      return toast.error("The end date can't be before the start date.");
    const budgetMajor = Number.parseFloat(budget);
    if (budget.trim() && (!Number.isFinite(budgetMajor) || budgetMajor <= 0))
      return toast.error("The budget must be greater than zero.");

    const input: NewEventInput = {
      name: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      budget: budget.trim() ? toMinorUnits(budgetMajor, currency) : null,
      currency,
      color,
      notes: notes.trim() || null,
    };

    setSaving(true);
    if (editing) {
      const ok = await editEvent(editing.id, input);
      setSaving(false);
      if (!ok) return;
      toast.success("Event updated", { description: input.name });
    } else {
      const created = await createEvent(input);
      setSaving(false);
      if (!created) return;
      toast.success("Event created", { description: input.name });
      onCreated?.(created);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="display text-xl">
          {editing ? "Edit event" : "New event"}
        </DialogTitle>
        <DialogDescription>
          Group the expenses of a trip, wedding or project to see what it all cost.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="event-name">Name</Label>
        <Input
          id="event-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lahore trip"
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="event-start">Starts (optional)</Label>
          <Input
            id="event-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-end">Ends (optional)</Label>
          <Input
            id="event-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="event-budget">Budget (optional)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {currencyInfo(currency).symbol}
            </span>
            <Input
              id="event-budget"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="No limit"
              className="num pl-7"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-notes">Notes (optional)</Label>
        <Input
          id="event-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cousin's wedding + a few days in the north"
          maxLength={2000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {EVENT_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                color === c && "ring-2 ring-offset-2 ring-offset-background"
              )}
              style={{
                backgroundColor: c,
                ...(color === c ? { ["--tw-ring-color" as string]: c } : {}),
              }}
              aria-label="Pick color"
              aria-pressed={color === c}
            >
              {color === c && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
        </Button>
      </DialogFooter>
    </form>
  );
}
