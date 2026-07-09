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
} from "lucide-react";

import type { Asset } from "@/lib/data";
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
import { assetsBase } from "@/lib/compute";
import { UNIT_LABEL } from "@/lib/gold";
import { formatMoney, formatRelativeDay } from "@/lib/format";
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

export default function AssetsPage() {
  const {
    assets,
    openAddAsset,
    openEditAsset,
    deleteAsset,
    refreshGold,
    goldPricedAt,
    baseCurrency,
    fx,
  } = useAppData();
  const confirm = useConfirm();
  const [refreshing, setRefreshing] = useState(false);
  const hasGold = assets.some((a) => a.symbol === "XAU");

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshGold();
    } finally {
      setRefreshing(false);
    }
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
                <RefreshCw
                  className={cn("size-4", refreshing && "animate-spin")}
                />
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
            Gold priced {formatRelativeDay(goldPricedAt)} · live spot × your
            holdings.
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

          <Reveal delay={0.1}>
            <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card px-2">
              {sorted.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  baseValue={formatMoney(fx.toBase(a.value, a.currency), {
                    currency: baseCurrency,
                  })}
                  onEdit={() => openEditAsset(a)}
                  onDelete={() => confirmDelete(a)}
                />
              ))}
            </ul>
          </Reveal>
        </>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  baseValue,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  baseValue: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = icons[asset.type] ?? Package;
  const sameAsBase = baseValue === formatMoney(asset.value, { currency: asset.currency });
  const isGold = asset.symbol === "XAU";
  const pl =
    isGold && asset.costBasis != null ? asset.value - asset.costBasis : null;
  const plPct =
    pl != null && asset.costBasis ? (pl / asset.costBasis) * 100 : null;
  const goldSub =
    isGold && asset.quantity != null && asset.unit
      ? `${asset.quantity} ${UNIT_LABEL[asset.unit]} · ${asset.karat ?? 24}K`
      : null;
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
        <Icon className="size-4" />
      </span>
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
        {pl != null ? (
          <p
            className={cn(
              "num text-[11px] font-medium tabular-nums",
              pl >= 0 ? "text-income" : "text-expense"
            )}
          >
            {formatMoney(pl, { currency: asset.currency, signed: true })}
            {plPct != null ? ` · ${pl >= 0 ? "+" : ""}${plPct.toFixed(1)}%` : ""}
          </p>
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
    </li>
  );
}
