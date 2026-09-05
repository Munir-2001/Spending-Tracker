"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import type { Client } from "@/lib/data";
import type { NewClientInput } from "@/lib/schema";
import { CURRENCIES } from "@/lib/currency";

export function ClientDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewClientInput) => void;
  onSave: (id: string, input: NewClientInput) => void;
  onDelete: (id: string) => void;
  editing: Client | null;
}) {
  const isEditing = Boolean(editing);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setName(editing.name);
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setAddress(editing.address ?? "");
      setTaxId(editing.taxId ?? "");
      setCurrency(editing.currency);
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setTaxId("");
      setCurrency("USD");
      setNotes("");
    }
  }, [open, editing]);

  function trimOrNull(s: string): string | null {
    const t = s.trim();
    return t.length ? t : null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the client a name.");
    const input: NewClientInput = {
      name: name.trim(),
      email: trimOrNull(email),
      phone: trimOrNull(phone),
      address: trimOrNull(address),
      taxId: trimOrNull(taxId),
      currency,
      notes: trimOrNull(notes),
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Client updated", { description: name.trim() });
    } else {
      onCreate(input);
      toast.success("Client added", { description: name.trim() });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    onDelete(editing.id);
    toast.success("Client removed", { description: editing.name });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit client" : "New client"}
          </DialogTitle>
          <DialogDescription>
            Who you bill. Contact details appear on their invoices.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">Name</Label>
            <Input
              id="cl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc. · Jane Doe"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-email">Email</Label>
              <Input
                id="cl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@acme.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-phone">Phone</Label>
              <Input
                id="cl-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-address">Billing address</Label>
            <textarea
              id="cl-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Street, city, country"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-tax">Tax ID</Label>
              <Input
                id="cl-tax"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="VAT / GST / NTN"
              />
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
            <Label htmlFor="cl-notes">Notes</Label>
            <Input
              id="cl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note (optional)"
            />
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Save changes" : "Add client"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
