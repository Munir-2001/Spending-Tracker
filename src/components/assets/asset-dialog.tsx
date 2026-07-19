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
import { COINS, coinById } from "@/lib/coins";
import { cn } from "@/lib/utils";

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

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  // Gold purchase, itemized (first lot on create).
  const [goldPrice, setGoldPrice] = useState("");
  const [commission, setCommission] = useState("");
  const [tax, setTax] = useState("");
  const [lotDate, setLotDate] = useState("");
  const [coinId, setCoinId] = useState("");
  const [coinSearch, setCoinSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isGold = type === "gold";
  const isCrypto = type === "crypto";

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
      // Editing a gold holding changes metadata only — purchases (cost basis)
      // are managed as lots on the asset's page, so the split fields stay blank.
      setGoldPrice("");
      setCommission("");
      setTax("");
      setLotDate(todayIso());
      setCoinId(editing.type === "crypto" ? editing.symbol ?? "" : "");
      setCoinSearch("");
    } else {
      setName("");
      setType("property");
      setValue("");
      setCurrency("USD");
      setNote("");
      setQuantity("");
      setKarat(24);
      setGoldPrice("");
      setCommission("");
      setTax("");
      setLotDate(todayIso());
      setCoinId("");
      setCoinSearch("");
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the asset a name.");

    if (isGold) {
      // Editing a gold holding = metadata only; preserve its lot-derived
      // aggregates so updateAsset doesn't null them out.
      if (editing) {
        onSave(editing.id, {
          name: name.trim(),
          type,
          value: editing.value,
          currency: editing.currency,
          note: note.trim() || null,
          symbol: "XAU",
          quantity: editing.quantity,
          unit: editing.unit ?? "tola",
          karat: editing.karat,
          costBasis: editing.costBasis,
        });
        toast.success("Gold updated", { description: name.trim() });
        onOpenChange(false);
        return;
      }

      const qty = Number.parseFloat(quantity);
      if (!Number.isFinite(qty) || qty <= 0)
        return toast.error("Enter how much gold you hold (in tola).");
      const gp = Number.parseFloat(goldPrice);
      if (!Number.isFinite(gp) || gp < 0)
        return toast.error("Enter the gold price you paid.");
      const cm = Number.parseFloat(commission) || 0;
      const tx = Number.parseFloat(tax) || 0;
      const goldCostMinor = toMinorUnits(gp, currency);
      const commissionMinor = toMinorUnits(cm, currency);
      const taxMinor = toMinorUnits(tx, currency);
      const costMinor = goldCostMinor + commissionMinor + taxMinor;
      onCreate({
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
        firstLot: {
          date: lotDate || todayIso(),
          goldCost: goldCostMinor,
          commission: commissionMinor,
          tax: taxMinor,
        },
      });
      toast.success("Gold added", {
        description: "Prices refresh automatically.",
      });
      onOpenChange(false);
      return;
    }

    if (isCrypto) {
      // Editing = metadata only; preserve lot-derived aggregates.
      if (editing) {
        onSave(editing.id, {
          name: name.trim(),
          type,
          value: editing.value,
          currency: editing.currency,
          note: note.trim() || null,
          symbol: editing.symbol,
          quantity: editing.quantity,
          unit: null,
          karat: null,
          costBasis: editing.costBasis,
        });
        toast.success("Crypto updated", { description: name.trim() });
        onOpenChange(false);
        return;
      }

      const coin = coinById(coinId);
      if (!coin) return toast.error("Pick a coin.");
      const qty = Number.parseFloat(quantity);
      if (!Number.isFinite(qty) || qty <= 0)
        return toast.error(`Enter how many ${coin.symbol} you hold.`);
      const cc = Number.parseFloat(goldPrice);
      if (!Number.isFinite(cc) || cc < 0)
        return toast.error("Enter what you paid for the coins.");
      const cm = Number.parseFloat(commission) || 0;
      const tx = Number.parseFloat(tax) || 0;
      const coinCostMinor = toMinorUnits(cc, currency);
      const feeMinor = toMinorUnits(cm, currency);
      const taxMinor = toMinorUnits(tx, currency);
      const costMinor = coinCostMinor + feeMinor + taxMinor;
      onCreate({
        name: name.trim(),
        type,
        value: costMinor,
        currency,
        note: note.trim() || null,
        symbol: coinId,
        quantity: qty,
        karat: null,
        costBasis: costMinor,
        firstLot: {
          date: lotDate || todayIso(),
          goldCost: coinCostMinor,
          commission: feeMinor,
          tax: taxMinor,
        },
      });
      toast.success("Crypto added", { description: "Prices refresh automatically." });
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

  const gpNum = Number.parseFloat(goldPrice) || 0;
  const cmNum = Number.parseFloat(commission) || 0;
  const txNum = Number.parseFloat(tax) || 0;
  const totalCost = gpNum + cmNum + txNum;
  const makingPct = gpNum > 0 ? ((cmNum + txNum) / gpNum) * 100 : 0;
  const sym = currencyInfo(currency).symbol;
  const qtyNum = Number.parseFloat(quantity) || 0;
  const ratePerTola = qtyNum > 0 && gpNum > 0 ? gpNum / qtyNum : 0;
  const selectedCoin = coinById(coinId);
  const coinSearchQ = coinSearch.trim().toLowerCase();
  const filteredCoins = coinSearchQ
    ? COINS.filter(
        (c) =>
          c.name.toLowerCase().includes(coinSearchQ) ||
          c.symbol.toLowerCase().includes(coinSearchQ)
      )
    : COINS;

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

              {isEditing ? (
                <p className="rounded-md bg-muted/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Cost basis and purchases are managed as lots on the asset — use
                  “Add purchase” on the assets page to record another buy.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gold-date">Purchase date</Label>
                    <Input
                      id="gold-date"
                      type="date"
                      value={lotDate}
                      onChange={(e) => setLotDate(e.target.value)}
                      max={todayIso()}
                    />
                  </div>

                  <div className="space-y-2 rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-medium">What you paid ({currency})</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="gold-price" className="text-xs text-muted-foreground">
                        Gold price
                      </Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {sym}
                        </span>
                        <Input
                          id="gold-price"
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
                          Rate:{" "}
                          <span className="num">
                            {sym}
                            {ratePerTola.toLocaleString(undefined, {
                              maximumFractionDigits: currencyInfo(currency).decimals,
                            })}
                          </span>{" "}
                          / tola
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="gold-comm" className="text-xs text-muted-foreground">
                          Making / commission
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {sym}
                          </span>
                          <Input
                            id="gold-comm"
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
                        <Label htmlFor="gold-tax" className="text-xs text-muted-foreground">
                          Tax (optional)
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {sym}
                          </span>
                          <Input
                            id="gold-tax"
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
                        {totalCost.toLocaleString(undefined, {
                          maximumFractionDigits: currencyInfo(currency).decimals,
                        })}
                      </span>
                    </div>
                    {gpNum > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Making charge: {makingPct.toFixed(1)}% over metal. Current value
                        updates from the live gold price — we&apos;ll show your profit/loss.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          ) : isCrypto ? (
            <>
              <div className="space-y-1.5">
                <Label>Coin</Label>
                <Input
                  placeholder="Search coin…"
                  value={coinSearch}
                  onChange={(e) => setCoinSearch(e.target.value)}
                />
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border/60">
                  {filteredCoins.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No coins match.</p>
                  ) : (
                    filteredCoins.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setCoinId(c.id);
                          if (!name.trim()) setName(c.name);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                          coinId === c.id && "bg-primary/10 font-medium text-foreground"
                        )}
                      >
                        <span>{c.name}</span>
                        <span className="num text-xs text-muted-foreground">{c.symbol}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {isEditing ? (
                <p className="rounded-md bg-muted/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Cost basis and purchases are managed as lots — use “Add purchase” on
                  the assets page to record another buy.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="crypto-qty">
                        Quantity{selectedCoin ? ` (${selectedCoin.symbol})` : ""}
                      </Label>
                      <Input
                        id="crypto-qty"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g. 0.5"
                        className="num"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="crypto-date">Purchase date</Label>
                      <Input
                        id="crypto-date"
                        type="date"
                        value={lotDate}
                        max={todayIso()}
                        onChange={(e) => setLotDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-medium">What you paid ({currency})</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="crypto-cost" className="text-xs text-muted-foreground">
                        Coin cost
                      </Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {sym}
                        </span>
                        <Input
                          id="crypto-cost"
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
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="crypto-fee" className="text-xs text-muted-foreground">
                          Exchange fee
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {sym}
                          </span>
                          <Input
                            id="crypto-fee"
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
                        <Label htmlFor="crypto-tax" className="text-xs text-muted-foreground">
                          Tax (optional)
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {sym}
                          </span>
                          <Input
                            id="crypto-tax"
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
                        {totalCost.toLocaleString(undefined, {
                          maximumFractionDigits: currencyInfo(currency).decimals,
                        })}
                      </span>
                    </div>
                    {qtyNum > 0 && gpNum > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Avg price: {sym}
                        {(gpNum / qtyNum).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        / {selectedCoin?.symbol ?? "coin"}. Value updates from the live price.
                      </p>
                    )}
                  </div>
                </>
              )}
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
