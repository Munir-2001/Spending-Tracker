/**
 * Precious-metal units. Gold spot is quoted per troy ounce; people in Pakistan
 * think in tola / grams. These constants convert a holding to grams so it can
 * be valued against a per-gram price.
 */
import type { MetalUnit } from "@/lib/schema";

export const GRAMS_PER_UNIT: Record<MetalUnit, number> = {
  gram: 1,
  gram10: 10,
  tola: 11.6638038, // standard Pakistani tola
  ozt: 31.1034768, // troy ounce
};

export const UNIT_LABEL: Record<MetalUnit, string> = {
  gram: "g",
  gram10: "×10 g",
  tola: "tola",
  ozt: "ozt",
};

/** Convert a quantity in `unit` to grams. */
export function gramsOf(quantity: number, unit: MetalUnit): number {
  return quantity * GRAMS_PER_UNIT[unit];
}

/** Purity multiplier for a karat value (24 = pure). */
export function purityOf(karat: number | null | undefined): number {
  return (karat ?? 24) / 24;
}

/**
 * Market value (major units of the price's currency) of a holding, given the
 * 24k per-gram spot price. Karat scales it down proportionally.
 */
export function goldValueMajor(
  quantity: number,
  unit: MetalUnit,
  karat: number | null | undefined,
  gram24kPrice: number
): number {
  return gramsOf(quantity, unit) * gram24kPrice * purityOf(karat);
}