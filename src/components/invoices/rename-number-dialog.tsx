"use client";

import { useState } from "react";

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
import { useInvoices } from "@/components/invoices/invoices-provider";
import type { Invoice } from "@/lib/data";
import { cleanInvoiceNumber, isDraftNumber, MAX_INVOICE_NUMBER_LENGTH } from "@/lib/invoice";

/**
 * Change an invoice's number at any status — e.g. fix a typo the client
 * spotted after it was sent. The share link and PDF update immediately.
 */
export function RenameNumberDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Keyed so it reopens with the current number. */}
        {open && (
          <RenameForm key={invoice.number} invoice={invoice} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { rename } = useInvoices();
  const current = isDraftNumber(invoice.number) ? "" : invoice.number;
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isSent = invoice.status !== "draft";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cleanInvoiceNumber(value);
    if (!cleaned.ok) return setError(cleaned.error);
    if (cleaned.value === current) return onDone();
    setSaving(true);
    const ok = await rename(invoice.id, cleaned.value);
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className="display text-xl">
          {current ? "Rename invoice number" : "Set invoice number"}
        </DialogTitle>
        <DialogDescription>
          {isSent
            ? "Updates the invoice, its share link and PDF right away. Let your client know if they already have a copy."
            : "Leave the draft unnumbered to get the next number automatically when you send it."}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="inv-rename">Invoice number</Label>
        <Input
          id="inv-rename"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="e.g. INV-0006"
          maxLength={MAX_INVOICE_NUMBER_LENGTH}
          autoFocus
          className="num"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <DialogFooter className="mt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save number"}
        </Button>
      </DialogFooter>
    </form>
  );
}
