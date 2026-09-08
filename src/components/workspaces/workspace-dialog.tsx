"use client";

import { useEffect, useState } from "react";

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

/**
 * Create or rename a workspace. `editingName === null` → create mode; a string →
 * rename mode (pre-filled). Doubles for both to keep one form.
 */
export function WorkspaceDialog({
  open,
  onOpenChange,
  onSubmit,
  editingName,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  editingName: string | null;
  busy?: boolean;
}) {
  const isEdit = editingName !== null;
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(editingName ?? "");
  }, [open, editingName]);

  function submit() {
    const n = name.trim();
    if (n) onSubmit(n);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rename workspace" : "New workspace"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Give this workspace a new name."
              : "A separate book — its own accounts, transactions, invoices, and settings."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Business"
            maxLength={60}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
