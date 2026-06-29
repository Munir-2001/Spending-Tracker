"use client";

import { useState } from "react";
import { Plus, Pencil, Target } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/components/transactions/transactions-provider";
import type { Goal } from "@/lib/data";
import { toMinorUnits } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function GoalsPage() {
  const { goals, openAddGoal } = useAppData();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">Goals</h1>
            <p className="text-sm text-muted-foreground">
              Save toward what matters. Progress is tracked on its own — it
              doesn&apos;t move your account balances.
            </p>
          </div>
          <Button onClick={openAddGoal} className="shrink-0 gap-1.5">
            <Plus className="size-4" />
            New goal
          </Button>
        </div>
      </Reveal>

      {goals.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Target className="size-6" />
            </span>
            <div>
              <p className="font-medium">No goals yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a target — an emergency fund, a trip, a new laptop — and
                track how close you are.
              </p>
            </div>
            <Button onClick={openAddGoal} variant="outline" className="mt-1 gap-1.5">
              <Plus className="size-4" />
              New goal
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((g, i) => (
            <Reveal key={g.id} delay={0.05 + i * 0.04}>
              <GoalCard goal={g} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function monthsUntil(iso: string): number {
  const now = new Date();
  const d = new Date(`${iso}T00:00:00`);
  const months =
    (d.getFullYear() - now.getFullYear()) * 12 +
    (d.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function GoalCard({ goal }: { goal: Goal }) {
  const { openEditGoal, contributeGoal } = useAppData();
  const [add, setAdd] = useState("");

  const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
  const remaining = Math.max(0, goal.target - goal.saved);
  const reached = goal.saved >= goal.target;
  const fmt = (n: number) => formatMoney(n, { currency: goal.currency });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const major = Number.parseFloat(add);
    if (!Number.isFinite(major) || major === 0) return;
    contributeGoal(goal.id, toMinorUnits(major, goal.currency));
    setAdd("");
  }

  const perMonth =
    !reached && goal.targetDate ? remaining / monthsUntil(goal.targetDate) : null;

  return (
    <div className="flex flex-col rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: goal.tint }}
          />
          <p className="truncate font-medium">{goal.name}</p>
        </div>
        <button
          type="button"
          onClick={() => openEditGoal(goal)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Edit goal"
        >
          <Pencil className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="num text-2xl font-medium tabular-nums">
          {fmt(goal.saved)}
        </span>
        <span className="text-sm text-muted-foreground">of {fmt(goal.target)}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: goal.tint }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="num text-muted-foreground">{Math.round(pct)}%</span>
        <span className={cn(reached ? "text-income" : "text-muted-foreground")}>
          {reached ? "Reached 🎉" : `${fmt(remaining)} to go`}
        </span>
      </div>

      {perMonth !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          ≈ <span className="num">{fmt(perMonth)}</span>/mo to reach by{" "}
          {new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
        </p>
      )}

      {!reached && (
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
            placeholder="Add funds…"
            className="num h-9"
          />
          <Button type="submit" size="sm" variant="outline" className="h-9 shrink-0">
            Add
          </Button>
        </form>
      )}
    </div>
  );
}
