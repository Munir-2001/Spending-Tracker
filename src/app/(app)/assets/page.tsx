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
import { assetsBase, goldPL, lotPL, cryptoPL, cryptoLotPL } from "@/lib/compute";
import { UNIT_LABEL, GRAMS_PER_UNIT } from "@/lib/gold";
import { coinTicker } from "@/lib/coins";
import { formatMoney, formatRelativeDay } from "@/lib/format";
import { toMajorUnits, type Fx } from "@/lib/currency";
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
  const hasMarket = assets.some((a) => a.symbol); // gold or crypto (live-priced)

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

  // Cumulative performance of a market holding class vs. what you paid. The
  // percentage is FX-invariant (the rate cancels in value/cost); amounts show in
  // the holdings' own currency when they share one, else the base currency.
  const perfOf = (list: typeof assets) => {
    const ccys = new Set(list.map((a) => a.currency));
    const ccy = ccys.size === 1 ? [...ccys][0] : baseCurrency;
    const cost = list.reduce((s, a) => s + fx.convert(a.costBasis ?? 0, a.currency, ccy), 0);
    const value = list.reduce((s, a) => s + fx.convert(a.value, a.currency, ccy), 0);
    const pl = value - cost;
    const dir: "up" | "down" | "flat" = pl > 0 ? "up" : pl < 0 ? "down" : "flat";
    return { ccy, cost, value, pl, plPct: cost ? (pl / cost) * 100 : 0, dir };
  };
  const goldPerf = perfOf(assets.filter((a) => a.symbol === "XAU"));
  const cryptoPerf = perfOf(
    assets.filter((a) => a.type === "crypto" && a.symbol && a.symbol !== "XAU")
  );
  const hasCrypto = assets.some((a) => a.type === "crypto" && a.symbol && a.symbol !== "XAU");

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
            {hasMarket && (
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

      {hasMarket && goldPricedAt && (
        <Reveal delay={0.03}>
          <p className="mt-3 text-xs text-muted-foreground">
            Priced {formatRelativeDay(goldPricedAt)} · live spot (USD) × your
            holdings, converted at your rates.
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
              <PerfCard label="Gold · vs what you paid" perf={goldPerf} />
            </Reveal>
          )}
          {hasCrypto && (
            <Reveal delay={0.1}>
              <PerfCard label="Crypto · vs what you paid" perf={cryptoPerf} />
            </Reveal>
          )}

          <Reveal delay={0.1}>
            <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card px-2">
              {sorted.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  lots={
                    a.symbol
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
  const isCrypto = asset.type === "crypto" && !!asset.symbol && asset.symbol !== "XAU";
  const isMarket = isGold || isCrypto;
  const gpl = isGold ? goldPL(asset, lots, fx, usdGram) : null;
  const cpl = isCrypto ? cryptoPL(asset, lots, fx) : null;
  const pl = gpl ?? cpl; // both expose { native, usd }
  const ticker = isCrypto ? coinTicker(asset.symbol) : "";
  const fmtQty = (q: number, d = 2) =>
    q.toLocaleString(undefined, { maximumFractionDigits: d });
  const sub =
    isGold && asset.quantity != null && asset.unit
      ? `${fmtQty(asset.quantity)} ${UNIT_LABEL[asset.unit]} · ${asset.karat ?? 24}K`
      : isCrypto && asset.quantity != null
        ? `${fmtQty(asset.quantity, 8)} ${ticker}`
        : null;
  // Current per-unit price used to value each lot in the history.
  const gramPrice = isGold ? gramPriceIn(asset.currency, usdGram, fx) : null;
  const coinPrice =
    isCrypto && asset.quantity
      ? toMajorUnits(asset.value, asset.currency) / asset.quantity
      : null;

  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-3">
        {isMarket ? (
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
            {sub ? ` · ${sub}` : ""}
            {!isMarket && asset.note ? ` · ${asset.note}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-sm font-semibold tabular-nums">
            {formatMoney(asset.value, { currency: asset.currency })}
          </p>
          {pl ? (
            <>
              <p
                className={cn(
                  "num text-[11px] font-medium tabular-nums",
                  pl.native.pl >= 0 ? "text-income" : "text-expense"
                )}
              >
                {formatMoney(pl.native.pl, { currency: asset.currency, signed: true })}
                {pl.native.plPct != null
                  ? ` · ${pl.native.pl >= 0 ? "+" : ""}${pl.native.plPct.toFixed(1)}%`
                  : ""}
              </p>
              <p className="num text-[11px] tabular-nums text-muted-foreground">
                ≈ {formatMoney(pl.usd.value, { currency: "USD" })}
                <span className={pl.usd.pl >= 0 ? "text-income" : "text-expense"}>
                  {" "}
                  {formatMoney(pl.usd.pl, { currency: "USD", signed: true })}
                </span>
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
            {isMarket && (
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

      {isMarket && expanded && (
        <div className="mb-2 ml-[3.25rem] mr-2 rounded-xl border border-border/60 bg-surface/50 p-3">
          {pl && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] text-muted-foreground">
              <span>
                Avg cost{" "}
                <span className="num text-foreground">
                  {gpl
                    ? `${formatMoney(Math.round(gpl.avgCostPerGram * GRAMS_PER_UNIT.tola), {
                        currency: asset.currency,
                      })}/tola`
                    : `${formatMoney(Math.round(cpl!.avgCostPerUnit), {
                        currency: asset.currency,
                      })}/${ticker}`}
                </span>
              </span>
              <span>
                {isGold ? "Making charge" : "Fees"}{" "}
                <span className="num text-foreground">
                  {(gpl?.makingChargePct ?? cpl?.feePct ?? 0).toFixed(1)}%
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
                const val =
                  gramPrice != null
                    ? lotPL(lot, gramPrice)
                    : coinPrice != null
                      ? cryptoLotPL(lot, coinPrice)
                      : null;
                return (
                  <li key={lot.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="num text-xs font-medium">
                        {fmtQty(lot.quantity, isCrypto ? 8 : 2)}{" "}
                        {isCrypto
                          ? ticker
                          : `${UNIT_LABEL[lot.unit ?? "tola"]} · ${lot.karat ?? 24}K`}
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
                            /{isCrypto ? ticker : "tola"}
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

type Perf = {
  ccy: string;
  cost: number;
  value: number;
  pl: number;
  plPct: number;
  dir: "up" | "down" | "flat";
};

/** Cumulative up/down performance of a holding class vs. what was paid. */
function PerfCard({ label, perf }: { label: string; perf: Perf }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center justify-between gap-4 rounded-2xl border p-5",
        perf.dir === "up" && "border-income/25 bg-income/[0.06]",
        perf.dir === "down" && "border-expense/25 bg-expense/[0.06]",
        perf.dir === "flat" && "border-border/60 bg-card"
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="num mt-1.5 truncate text-sm">
          {formatMoney(perf.value, { currency: perf.ccy })}
          <span className="text-muted-foreground/70"> now · </span>
          {formatMoney(perf.cost, { currency: perf.ccy })}
          <span className="text-muted-foreground/70"> paid</span>
        </p>
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          perf.dir === "up" && "text-income",
          perf.dir === "down" && "text-expense",
          perf.dir === "flat" && "text-muted-foreground"
        )}
      >
        {perf.dir === "up" ? (
          <ArrowUpRight className="size-7" strokeWidth={2.25} />
        ) : perf.dir === "down" ? (
          <ArrowDownRight className="size-7" strokeWidth={2.25} />
        ) : (
          <Minus className="size-7" strokeWidth={2.25} />
        )}
        <div className="text-right">
          <p className="num text-2xl font-semibold leading-none tabular-nums">
            {perf.pl > 0 ? "+" : ""}
            {perf.plPct.toFixed(1)}%
          </p>
          <p className="num mt-1 text-xs font-medium tabular-nums">
            {formatMoney(perf.pl, { currency: perf.ccy, signed: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
