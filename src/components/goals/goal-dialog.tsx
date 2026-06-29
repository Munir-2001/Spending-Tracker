"use client";

import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
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
import type { Goal } from "@/lib/data";
import type { NewGoalInput } from "@/lib/schema";
import {
  CURRENCIES,
  currencyInfo,
  toMajorUnits,
  toMinorUnits,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

const PALETTE = [
  "var(--cat-1)",
  "var(--cat-3)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-8)",
  "var(--cat-10)",
];

export function GoalDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewGoalInput) => void;
  onSave: (id: string, input: NewGoalInput) => void;
  onDelete: (id: string) => void;
  editing: Goal | null;
}) {
  const isEditing = Boolean(editing);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setName(editing.name);
      setTarget(String(toMajorUnits(editing.target, editing.currency)));
      setSaved(String(toMajorUnits(editing.saved, editing.currency)));
      setCurrency(editing.currency);
      setTargetDate(editing.targetDate ?? "");
      setColor(editing.tint);
    } else {
      setName("");
      setTarget("");
      setSaved("");
      setCurrency("USD");
      setTargetDate("");
      setColor(PALETTE[0]);
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the goal a name.");
    const tgt = Number.parseFloat(target);
    if (!Number.isFinite(tgt) || tgt <= 0)
      return toast.error("Set a target amount.");
    const sav = Number.parseFloat(saved);
    const input: NewGoalInput = {
      name: name.trim(),
      target: toMinorUnits(tgt, currency),
      saved: Number.isFinite(sav) && sav > 0 ? toMinorUnits(sav, currency) : 0,
      currency,
      targetDate: targetDate || null,
      color,
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Goal updated", { description: name.trim() });
    } else {
      onCreate(input);
      toast.success("Goal created", { description: name.trim() });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    onDelete(editing.id);
    toast.success("Goal removed", { description: editing.name });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit goal" : "New savings goal"}
          </DialogTitle>
          <DialogDescription>
            Set a target to save toward. Progress is tracked separately — it
            doesn&apos;t move your account balances.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emergency fund"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target ({currency})</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencyInfo(currency).symbol}
                </span>
                <Input
                  id="goal-target"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="0"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-saved">Already saved</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencyInfo(currency).symbol}
                </span>
                <Input
                  id="goal-saved"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={saved}
                  onChange={(e) => setSaved(e.target.value)}
                  placeholder="0"
                  className="num pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Target date (optional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
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
                >
                  {color === c && <Check className="size-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "ghost"}
                size="sm"
                className="gap-1.5"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                {confirmDelete ? "Confirm delete" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Save changes" : "Create goal"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
