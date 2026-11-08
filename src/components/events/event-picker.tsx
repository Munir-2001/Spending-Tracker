"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEvents } from "@/components/events/events-provider";

/** Select value for "not part of any event" (Radix Select can't use ""). */
export const NO_EVENT = "none";

/** Optional "Event" field for the expense form. Hidden until an event exists. */
export function EventPicker({
  value,
  onChange,
}: {
  value: string; // event id or NO_EVENT
  onChange: (value: string) => void;
}) {
  const { events } = useEvents();
  if (events.length === 0) return null;

  // Keep a linked-but-missing id selectable rather than silently dropping it.
  const known = value === NO_EVENT || events.some((e) => e.id === value);

  return (
    <div className="space-y-1.5">
      <Label>Event (optional)</Label>
      <Select value={known ? value : NO_EVENT} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_EVENT}>
            <span className="text-muted-foreground">Not part of an event</span>
          </SelectItem>
          {events.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: e.tint }} />
                {e.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
