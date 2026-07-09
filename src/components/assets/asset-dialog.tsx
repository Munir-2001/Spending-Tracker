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
import type { Asset } from "@/lib/data";
import type { AssetType, NewAssetInput } from "@/lib/schema";
import {
  CURRENCIES,
  currencyInfo,
  toMajorUnits,
  toMinorUnits,
} from "@/lib/currency";

export const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "property", label: "Property / real estate" },
  { value: "vehicle", label: "Vehicle" },
  { value: "gold", label: "Gold (live price)" },
  { value: "crypto", label: "Crypto" },
  { value: "investment", label: "Investment / stocks" },
  { value: "cash", label: "Cash / savings" },
  { value: "valuable", label: "Valuable (jewelry, art…)" },
  { value: "other", label: "Other" },
];

const KARATS = [24, 22, 21, 18];

export function AssetDialog({
  open,
  onOpenChange,
  onCreate,
  onSave,
  onDelete,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewAssetInput) => void;
  onSave: (id: string, input: NewAssetInput) => void;
  onDelete: (id: string) => void;
  editing: Asset | null;
}) {
  const isEditing = Boolean(editing);
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("property");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("");
  const [karat, setKarat] = useState(24);
  const [cost, setCost] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isGold = type === "gold";

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setValue(String(toMajorUnits(editing.value, editing.currency)));
      setCurrency(editing.currency);
      setNote(editing.note ?? "");
      setQuantity(editing.quantity != null ? String(editing.quantity) : "");
      setKarat(editing.karat ?? 24);
      setCost(
        editing.costBasis != null
          ? String(toMajorUnits(editing.costBasis, editing.currency))
          : ""
      );
    } else {
      setName("");
      setType("property");
      setValue("");
      setCurrency("USD");
      setNote("");
      setQuantity("");
      setKarat(24);
      setCost("");
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the asset a name.");

    if (isGold) {
      const qty = Number.parseFloat(quantity);
      if (!Number.isFinite(qty) || qty <= 0)
        return toast.error("Enter how much gold you hold (in tola).");
      const paid = Number.parseFloat(cost);
      if (!Number.isFinite(paid) || paid < 0)
        return toast.error("Enter what you paid for it.");
      const costMinor = toMinorUnits(paid, currency);
      const input: NewAssetInput = {
        name: name.trim(),
        type,
        // Seed value with cost until the first live price refresh updates it.
        value: costMinor,
        currency,
        note: note.trim() || null,
        symbol: "XAU",
        quantity: qty,
        unit: "tola",
        karat,
        costBasis: costMinor,
      };
      if (editing) {
        onSave(editing.id, input);
        toast.success("Gold updated", { description: name.trim() });
      } else {
        onCreate(input);
        toast.success("Gold added", {
          description: "Prices refresh automatically.",
        });
      }
      onOpenChange(false);
      return;
    }

    const major = Number.parseFloat(value);
    if (!Number.isFinite(major) || major < 0)
      return toast.error("Enter a value.");
    const input: NewAssetInput = {
      name: name.trim(),
      type,
      value: toMinorUnits(major, currency),
      currency,
      note: note.trim() || null,
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Asset updated", { description: name.trim() });
    } else {
      onCreate(input);
      toast.success("Asset added", { description: name.trim() });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    onDelete(editing.id);
    toast.success("Asset removed", { description: editing.name });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit asset" : "Add asset"}
          </DialogTitle>
          <DialogDescription>
            Something you own with a current value — counts toward your net worth.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apartment in Trento"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  const next = v as AssetType;
                  setType(next);
                  // Gold is bought/priced in PKR here — nudge the default.
                  if (next === "gold" && currency === "USD") setCurrency("PKR");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {isGold ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gold-qty">Quantity (tola)</Label>
                  <Input
                    id="gold-qty"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 3"
                    className="num"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Purity</Label>
                  <Select
                    value={String(karat)}
                    onValueChange={(v) => setKarat(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KARATS.map((k) => (
                        <SelectItem key={k} value={String(k)}>
                          {k}K{k === 24 ? " (pure)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gold-cost">What you paid ({currency})</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencyInfo(currency).symbol}
                  </span>
                  <Input
                    id="gold-cost"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                    className="num pl-7"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Your cost basis. Current value updates from the live gold price —
                  we&apos;ll show your profit/loss.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="asset-value">Current value ({currency})</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencyInfo(currency).symbol}
                </span>
                <Input
                  id="asset-value"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className="num pl-7"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="asset-note">Note (optional)</Label>
            <Input
              id="asset-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="0.5 BTC · estimate"
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
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Save changes" : "Add asset"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
