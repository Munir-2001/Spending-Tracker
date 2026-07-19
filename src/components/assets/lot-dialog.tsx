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
import type { Asset, AssetLot } from "@/lib/data";
import type { NewAssetLotInput } from "@/lib/schema";
import { currencyInfo, toMajorUnits, toMinorUnits } from "@/lib/currency";

const KARATS = [24, 22, 21, 18];
const todayIso = () => new Date().toISOString().slice(0, 10);

export function LotDialog({
  open,
  onOpenChange,
  asset,
  editing,
  onCreate,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
  editing: AssetLot | null;
  onCreate: (input: NewAssetLotInput) => void;
  onSave: (id: string, input: NewAssetLotInput) => void;
  onDelete: (id: string) => void;
}) {
  const isEditing = Boolean(editing);
  const currency = editing?.currency ?? asset?.currency ?? "PKR";
  const [date, setDate] = useState(todayIso());
  const [quantity, setQuantity] = useState("");
  const [karat, setKarat] = useState(24);
  const [goldPrice, setGoldPrice] = useState("");
  const [commission, setCommission] = useState("");
  const [tax, setTax] = useState("");
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setDate(editing.date);
      setQuantity(String(editing.quantity));
      setKarat(editing.karat ?? 24);
      setGoldPrice(String(toMajorUnits(editing.goldCost, editing.currency)));
      setCommission(
        editing.commission ? String(toMajorUnits(editing.commission, editing.currency)) : ""
      );
      setTax(editing.tax ? String(toMajorUnits(editing.tax, editing.currency)) : "");
      setNote(editing.note ?? "");
    } else {
      setDate(todayIso());
      setQuantity("");
      setKarat(asset?.karat ?? 24);
      setGoldPrice("");
      setCommission("");
      setTax("");
      setNote("");
    }
  }, [open, editing, asset]);

  const sym = currencyInfo(currency).symbol;
  const qtyNum = Number.parseFloat(quantity) || 0;
  const gp = Number.parseFloat(goldPrice) || 0;
  const cm = Number.parseFloat(commission) || 0;
  const tx = Number.parseFloat(tax) || 0;
  const total = gp + cm + tx;
  const makingPct = gp > 0 ? ((cm + tx) / gp) * 100 : 0;
  // Documented rate: what the metal cost per tola on this buy.
  const ratePerTola = qtyNum > 0 && gp > 0 ? gp / qtyNum : 0;
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: currencyInfo(currency).decimals });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset && !editing) return;
    const qty = Number.parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0)
      return toast.error("Enter how much gold this purchase was (in tola).");
    if (!Number.isFinite(gp) || gp < 0)
      return toast.error("Enter the gold price you paid.");
    const input: NewAssetLotInput = {
      assetId: editing?.assetId ?? asset!.id,
      date: date || todayIso(),
      quantity: qty,
      unit: "tola",
      karat,
      goldCost: toMinorUnits(gp, currency),
      commission: toMinorUnits(cm, currency),
      tax: toMinorUnits(tx, currency),
      currency,
      note: note.trim() || null,
    };
    if (editing) {
      onSave(editing.id, input);
      toast.success("Purchase updated");
    } else {
      onCreate(input);
      toast.success("Purchase added", { description: "Prices refresh automatically." });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    onDelete(editing.id);
    toast.success("Purchase removed");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">
            {isEditing ? "Edit purchase" : "Add purchase"}
          </DialogTitle>
          <DialogDescription>
            A single buy of {asset?.name ?? "gold"} — its own quantity and
            commission-inclusive cost.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lot-date">Purchase date</Label>
              <Input
                id="lot-date"
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lot-qty">Quantity (tola)</Label>
              <Input
                id="lot-qty"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2"
                className="num"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Purity</Label>
            <Select value={String(karat)} onValueChange={(v) => setKarat(Number(v))}>
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

          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-medium">What you paid ({currency})</p>
            <div className="space-y-1.5">
              <Label htmlFor="lot-price" className="text-xs text-muted-foreground">
                Gold price
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {sym}
                </span>
                <Input
                  id="lot-price"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={goldPrice}
                  onChange={(e) => setGoldPrice(e.target.value)}
                  placeholder="0"
                  className="num pl-7"
                />
              </div>
              {ratePerTola > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Rate: <span className="num">{sym}{fmt(ratePerTola)}</span> / tola
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lot-comm" className="text-xs text-muted-foreground">
                  Making / commission
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {sym}
                  </span>
                  <Input
                    id="lot-comm"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    placeholder="0"
                    className="num pl-7"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lot-tax" className="text-xs text-muted-foreground">
                  Tax (optional)
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {sym}
                  </span>
                  <Input
                    id="lot-tax"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="0"
                    className="num pl-7"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-baseline justify-between border-t border-border/60 pt-2">
              <span className="text-xs text-muted-foreground">Total cost basis</span>
              <span className="num text-sm font-semibold">
                {sym}
                {total.toLocaleString(undefined, {
                  maximumFractionDigits: currencyInfo(currency).decimals,
                })}
              </span>
            </div>
            {gp > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Making charge: {makingPct.toFixed(1)}% over metal.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lot-note">Note (optional)</Label>
            <Input
              id="lot-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Dealer, receipt #, karat mix…"
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
              <Button type="submit">{isEditing ? "Save changes" : "Add purchase"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
