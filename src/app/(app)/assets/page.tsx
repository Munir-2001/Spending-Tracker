"use client";

import { useState } from "react";
import {
  Home,
  Car,
  Coins,
  Bitcoin,
  TrendingUp,
  Banknote,
  Gem,
  Package,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Boxes,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

import type { Asset, AssetLot } from "@/lib/data";
import type { AssetType } from "@/lib/schema";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppData } from "@/components/transactions/transactions-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LotDialog } from "@/components/assets/lot-dialog";
import { assetsBase, goldPL, lotPL } from "@/lib/compute";
import { UNIT_LABEL, GRAMS_PER_UNIT } from "@/lib/gold";
import { formatMoney, formatRelativeDay } from "@/lib/format";
import type { Fx } from "@/lib/currency";
import { cn } from "@/lib/utils";

const icons: Record<AssetType, typeof Home> = {
  property: Home,
  vehicle: Car,
  gold: Coins,
  crypto: Bitcoin,
  investment: TrendingUp,
  cash: Banknote,
  valuable: Gem,
  other: Package,
};
const typeLabels: Record<AssetType, string> = {
  property: "Property",
  vehicle: "Vehicle",
  gold: "Gold",
  crypto: "Crypto",
  investment: "Investment",
  cash: "Cash",
  valuable: "Valuable",
  other: "Other",
};

/** Per-gram 24k price in `currency` derived from the USD spot + the user's rates. */
function gramPriceIn(currency: string, usdGram: number | null, fx: Fx): number | null {
  if (usdGram == null) return null;
  return (usdGram * (fx.rates.USD ?? 1)) / (fx.rates[currency] ?? 1);
}

export default function AssetsPage() {
  const {
    assets,
    lots,
    usdGram,
    openAddAsset,
    openEditAsset,
    deleteAsset,
    addLot,
    saveLot,
    deleteLot,
    refreshGold,
    goldPricedAt,
    baseCurrency,
    fx,
  } = useAppData();
  const confirm = useConfirm();
  const [refreshing, setRefreshing] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [lotAsset, setLotAsset] = useState<Asset | null>(null);
  const [editingLot, setEditingLot] = useState<AssetLot | null>(null);
  const hasGold = assets.some((a) => a.symbol === "XAU");

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshGold();
    } finally {
      setRefreshing(false);
    }
  }

  function openAddLot(asset: Asset) {
    setLotAsset(asset);
    setEditingLot(null);
    setLotOpen(true);
  }
  function openEditLot(asset: Asset, lot: AssetLot) {
    setLotAsset(asset);
    setEditingLot(lot);
    setLotOpen(true);
  }

  async function confirmDelete(asset: Asset) {
    const ok = await confirm({
      title: "Delete asset?",
      description: `“${asset.name}” will be removed from your net worth.`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) deleteAsset(asset.id);
  }

  const total = assetsBase(assets, fx);
  const sorted = [...assets].sort(
    (a, b) => fx.toBase(b.value, b.currency) - fx.toBase(a.value, a.currency)
  );

  // Cumulative gold performance vs. what you paid. The percentage is FX-invariant
  // (same rate cancels in value/cost), and amounts show in the gold's own
  // currency when all holdings share one, else the base currency.
  const goldAssets = assets.filter((a) => a.symbol === "XAU");
  const goldCcys = new Set(goldAssets.map((a) => a.currency));
  const goldCcy = goldCcys.size === 1 ? [...goldCcys][0] : baseCurrency;
  const goldCost = goldAssets.reduce(
    (s, a) => s + fx.convert(a.costBasis ?? 0, a.currency, goldCcy),
    0
  );
  const goldValue = goldAssets.reduce(
    (s, a) => s + fx.convert(a.value, a.currency, goldCcy),
    0
  );
  const goldPl = goldValue - goldCost;
  const goldPlPct = goldCost ? (goldPl / goldCost) * 100 : 0;
  const goldDir: "up" | "down" | "flat" =
    goldPl > 0 ? "up" : goldPl < 0 ? "down" : "flat";

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="display text-3xl tracking-tight md:text-4xl">Assets</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Things you own — property, vehicles, crypto, investments. Counted in
              your net worth.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasGold && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
                {refreshing ? "Updating…" : "Refresh prices"}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={openAddAsset}>
              <Plus className="size-4" />
              Add asset
            </Button>
          </div>
        </div>
      </Reveal>

      {hasGold && goldPricedAt && (
        <Reveal delay={0.03}>
          <p className="mt-3 text-xs text-muted-foreground">
            Gold priced {formatRelativeDay(goldPricedAt)} · international spot (USD)
            × your holdings, converted at your rates.
          </p>
        </Reveal>
      )}

      {assets.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Boxes className="size-6" />
            </span>
            <div>
              <p className="font-medium">No assets yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add things you own with a current value — they&apos;ll roll into
                your net worth in {baseCurrency}.
              </p>
            </div>
            <Button className="gap-1.5" onClick={openAddAsset}>
              <Plus className="size-4" />
              Add your first asset
            </Button>
          </div>
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <div className="mt-8 rounded-2xl border border-border/60 bg-primary p-6 text-primary-foreground">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
                Total assets · {baseCurrency}
              </p>
              <p className="display amount-lg mt-2 text-4xl leading-none">
                {formatMoney(total, { currency: baseCurrency })}
              </p>
              <p className="mt-2 text-xs text-primary-foreground/55">
                {assets.length} {assets.length === 1 ? "asset" : "assets"}
              </p>
            </div>
          </Reveal>

          {hasGold && (
            <Reveal delay={0.08}>
              <div
                className={cn(
                  "mt-3 flex items-center justify-between gap-4 rounded-2xl border p-5",
                  goldDir === "up" && "border-income/25 bg-income/[0.06]",
                  goldDir === "down" && "border-expense/25 bg-expense/[0.06]",
                  goldDir === "flat" && "border-border/60 bg-card"
                )}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Gold · vs what you paid
                  </p>
                  <p className="num mt-1.5 truncate text-sm">
                    {formatMoney(goldValue, { currency: goldCcy })}
                    <span className="text-muted-foreground/70"> now · </span>
                    {formatMoney(goldCost, { currency: goldCcy })}
                    <span className="text-muted-foreground/70"> paid</span>
                  </p>
                </div>
                <div
                  className={cn(
                    "flex shrink-0 items-center gap-2",
                    goldDir === "up" && "text-income",
                    goldDir === "down" && "text-expense",
                    goldDir === "flat" && "text-muted-foreground"
                  )}
                >
                  {goldDir === "up" ? (
                    <ArrowUpRight className="size-7" strokeWidth={2.25} />
                  ) : goldDir === "down" ? (
                    <ArrowDownRight className="size-7" strokeWidth={2.25} />
                  ) : (
                    <Minus className="size-7" strokeWidth={2.25} />
                  )}
                  <div className="text-right">
                    <p className="num text-2xl font-semibold leading-none tabular-nums">
                      {goldPl > 0 ? "+" : ""}
                      {goldPlPct.toFixed(1)}%
                    </p>
                    <p className="num mt-1 text-xs font-medium tabular-nums">
                      {formatMoney(goldPl, { currency: goldCcy, signed: true })}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal delay={0.1}>
            <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card px-2">
              {sorted.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  lots={
                    a.symbol === "XAU"
                      ? lots
                          .filter((l) => l.assetId === a.id)
                          .sort((x, y) => (x.date < y.date ? 1 : -1))
                      : []
                  }
                  usdGram={usdGram}
                  fx={fx}
                  baseValue={formatMoney(fx.toBase(a.value, a.currency), {
                    currency: baseCurrency,
                  })}
                  onEdit={() => openEditAsset(a)}
                  onDelete={() => confirmDelete(a)}
                  onAddLot={() => openAddLot(a)}
                  onEditLot={(lot) => openEditLot(a, lot)}
                />
              ))}
            </ul>
          </Reveal>
        </>
      )}

      <LotDialog
        open={lotOpen}
        onOpenChange={setLotOpen}
        asset={lotAsset}
        editing={editingLot}
        onCreate={addLot}
        onSave={saveLot}
        onDelete={deleteLot}
      />
    </div>
  );
}

function AssetRow({
  asset,
  lots,
  usdGram,
  fx,
  baseValue,
  onEdit,
  onDelete,
  onAddLot,
  onEditLot,
}: {
  asset: Asset;
  lots: AssetLot[];
  usdGram: number | null;
  fx: Fx;
  baseValue: string;
  onEdit: () => void;
  onDelete: () => void;
  onAddLot: () => void;
  onEditLot: (lot: AssetLot) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = icons[asset.type] ?? Package;
  const sameAsBase = baseValue === formatMoney(asset.value, { currency: asset.currency });
  const isGold = asset.symbol === "XAU";
  const gpl = isGold ? goldPL(asset, lots, fx, usdGram) : null;
  const goldSub =
    isGold && asset.quantity != null && asset.unit
      ? `${asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${
          UNIT_LABEL[asset.unit]
        } · ${asset.karat ?? 24}K`
      : null;
  const gramPrice = isGold ? gramPriceIn(asset.currency, usdGram, fx) : null;

  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-3">
        {isGold ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground transition-colors hover:text-foreground"
            aria-label={expanded ? "Collapse purchases" : "Show purchases"}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", expanded && "rotate-180")}
            />
          </button>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{asset.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {typeLabels[asset.type]}
            {goldSub ? ` · ${goldSub}` : ""}
            {!isGold && asset.note ? ` · ${asset.note}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-sm font-semibold tabular-nums">
            {formatMoney(asset.value, { currency: asset.currency })}
          </p>
          {gpl ? (
            <>
              <p
                className={cn(
                  "num text-[11px] font-medium tabular-nums",
                  gpl.native.pl >= 0 ? "text-income" : "text-expense"
                )}
              >
                {formatMoney(gpl.native.pl, { currency: asset.currency, signed: true })}
                {gpl.native.plPct != null
                  ? ` · ${gpl.native.pl >= 0 ? "+" : ""}${gpl.native.plPct.toFixed(1)}%`
                  : ""}
              </p>
              <p className="num text-[11px] tabular-nums text-muted-foreground">
                ≈ {formatMoney(gpl.usd.value, { currency: "USD" })}
                {usdGram != null ? (
                  <span className={gpl.usd.pl >= 0 ? "text-income" : "text-expense"}>
                    {" "}
                    {formatMoney(gpl.usd.pl, { currency: "USD", signed: true })}
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            !sameAsBase && (
              <p className="num text-[11px] text-muted-foreground">≈ {baseValue}</p>
            )
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8 text-muted-foreground")}
              aria-label="Asset actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isGold && (
              <DropdownMenuItem onClick={onAddLot}>
                <Plus className="size-4" />
                Add purchase
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isGold && expanded && (
        <div className="mb-2 ml-[3.25rem] mr-2 rounded-xl border border-border/60 bg-surface/50 p-3">
          {gpl && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] text-muted-foreground">
              <span>
                Avg cost{" "}
                <span className="num text-foreground">
                  {formatMoney(Math.round(gpl.avgCostPerGram * GRAMS_PER_UNIT.tola), {
                    currency: asset.currency,
                  })}
                  /tola
                </span>
              </span>
              <span>
                Making charge{" "}
                <span className="num text-foreground">
                  {gpl.makingChargePct.toFixed(1)}%
                </span>
              </span>
            </div>
          )}

          <ul className="divide-y divide-border/50">
            {lots.length === 0 ? (
              <li className="py-2 text-[11px] text-muted-foreground">
                No purchases recorded yet.
              </li>
            ) : (
              lots.map((lot) => {
                const val = gramPrice != null ? lotPL(lot, gramPrice) : null;
                return (
                  <li key={lot.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="num text-xs font-medium">
                        {lot.quantity.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {UNIT_LABEL[lot.unit]} · {lot.karat ?? 24}K
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatRelativeDay(lot.date)} · cost{" "}
                        <span className="num">
                          {formatMoney(lot.costBasis, { currency: lot.currency })}
                        </span>
                        {lot.commission + lot.tax > 0 ? (
                          <>
                            {" "}
                            (incl.{" "}
                            <span className="num">
                              {formatMoney(lot.commission + lot.tax, {
                                currency: lot.currency,
                              })}
                            </span>{" "}
                            fees)
                          </>
                        ) : null}
                        {lot.quantity > 0 ? (
                          <>
                            {" · "}
                            <span className="num">
                              {formatMoney(Math.round(lot.goldCost / lot.quantity), {
                                currency: lot.currency,
                              })}
                            </span>
                            /tola
                          </>
                        ) : null}
                      </p>
                      {lot.note ? (
                        <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground/80">
                          {lot.note}
                        </p>
                      ) : null}
                    </div>
                    {val && (
                      <p
                        className={cn(
                          "num text-[11px] font-medium tabular-nums",
                          val.pl >= 0 ? "text-income" : "text-expense"
                        )}
                      >
                        {formatMoney(val.pl, { currency: lot.currency, signed: true })}
                        {val.plPct != null
                          ? ` · ${val.pl >= 0 ? "+" : ""}${val.plPct.toFixed(1)}%`
                          : ""}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground"
                      aria-label="Edit purchase"
                      onClick={() => onEditLot(lot)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </li>
                );
              })
            )}
          </ul>

          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full gap-1.5"
            onClick={onAddLot}
          >
            <Plus className="size-4" />
            Add purchase
          </Button>
        </div>
      )}
    </li>
  );
}
