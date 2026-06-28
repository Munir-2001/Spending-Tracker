"use client";

import { useEffect, useState } from "react";
import { Trash2, Check } from "lucide-react";
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
import type { Category } from "@/lib/data";
import type { NewCategoryInput } from "@/lib/schema";
import { useAppData } from "@/components/transactions/transactions-provider";
import { cn } from "@/lib/utils";

// Category identity colors live as --cat-* tokens in globals.css so they adapt to dark mode.
const PALETTE = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
  "var(--cat-9)",
  "var(--cat-10)",
];

type Kind = "income" | "expense";

export function CategoryDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewCategoryInput) => void;
  onSave: (id: string, input: NewCategoryInput) => void;
  onDelete: (id: string) => void;
  editing: Category | null;
}) {
  const isEditing = Boolean(editing);
  const { categories } = useAppData();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [color, setColor] = useState(PALETTE[1]);
  const [parentId, setParentId] = useState<string>("none");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Possible parents: top-level categories of the same kind (and not itself).
  const parents = categories.filter(
    (c) => !c.parentId && c.kind === kind && c.id !== editing?.id
  );

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setName(editing.label);
      setKind(editing.kind);
      setColor(editing.tint);
      setParentId(editing.parentId ?? "none");
    } else {
      setName("");
      setKind("expense");
      setColor(PALETTE[1]);
      setParentId("none");
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the category a name.");
    const input: NewCategoryInput = {
      name: name.trim(),
      kind,
      color,
      parentId: parentId === "none" ? null : parentId,
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Category updated", { description: name.trim() });
    } else {
      onCreate(input);
      toast.success("Category created", { description: name.trim() });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(editing.id);
    toast.success("Category deleted", {
      description: `${editing.label} — its transactions are now uncategorized`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            Categories group your spending and income for budgets and reports.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setParentId("none");
                }}
                className={cn(
                  "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                  kind === k
                    ? k === "expense"
                      ? "bg-expense/10 text-expense"
                      : "bg-income/10 text-income"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meat"
              autoFocus
            />
          </div>

          {parents.length > 0 && (
            <div className="space-y-1.5">
              <Label>Parent category (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — top level</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: p.tint }}
                        />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Nest under a parent (e.g. Meat under Groceries). Spending rolls up
                to the parent in reports.
              </p>
            </div>
          )}

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
                  style={{ backgroundColor: c, ...(color === c ? { ["--tw-ring-color" as string]: c } : {}) }}
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
              <Button type="submit">{isEditing ? "Save changes" : "Create category"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
