"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createEvent as createEventAction,
  updateEvent as updateEventAction,
  deleteEvent as deleteEventAction,
} from "@/server/actions";
import type { SpendEvent } from "@/lib/data";
import type { NewEventInput } from "@/lib/schema";

/**
 * Owns the events list. Mounted OUTSIDE TransactionsProvider so the add-expense
 * dialog (rendered by that provider) can offer an "Event" picker. Linking
 * transactions to events lives in TransactionsProvider (`assignEvent`), since it
 * changes transactions.
 */
type EventsContext = {
  events: SpendEvent[];
  getEvent: (id: string | null | undefined) => SpendEvent | undefined;
  /** Resolves the created event, or null on failure (already toasted). */
  createEvent: (input: NewEventInput) => Promise<SpendEvent | null>;
  editEvent: (id: string, input: NewEventInput) => Promise<boolean>;
  /** Resolves true once deleted; its transactions are detached, not deleted. */
  removeEvent: (id: string) => Promise<boolean>;
};

const Ctx = createContext<EventsContext | null>(null);

export function useEvents(): EventsContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEvents must be used within EventsProvider");
  return ctx;
}

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export function EventsProvider({
  initialEvents,
  children,
}: {
  initialEvents: SpendEvent[];
  children: React.ReactNode;
}) {
  const [events, setEvents] = useState<SpendEvent[]>(initialEvents);

  const createEvent = useCallback(async (input: NewEventInput) => {
    try {
      const created = await createEventAction(input);
      setEvents((prev) => [...prev, created]);
      return created;
    } catch (e) {
      toast.error(errorText(e, "Couldn't create the event."));
      return null;
    }
  }, []);

  const editEvent = useCallback(async (id: string, input: NewEventInput) => {
    try {
      const updated = await updateEventAction(id, input);
      if (updated) setEvents((prev) => prev.map((x) => (x.id === id ? updated : x)));
      return Boolean(updated);
    } catch (e) {
      toast.error(errorText(e, "Couldn't update the event."));
      return false;
    }
  }, []);

  const removeEvent = useCallback(async (id: string) => {
    try {
      await deleteEventAction(id);
      setEvents((prev) => prev.filter((x) => x.id !== id));
      return true;
    } catch (e) {
      toast.error(errorText(e, "Couldn't delete the event."));
      return false;
    }
  }, []);

  const value = useMemo<EventsContext>(() => {
    const byId = new Map(events.map((e) => [e.id, e]));
    return {
      events,
      getEvent: (id) => (id ? byId.get(id) : undefined),
      createEvent,
      editEvent,
      removeEvent,
    };
  }, [events, createEvent, editEvent, removeEvent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
