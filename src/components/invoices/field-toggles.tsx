"use client";

import type { InvoiceFieldPrefs } from "@/lib/schema";

const FIELDS: { key: keyof InvoiceFieldPrefs; label: string }[] = [
  { key: "quantity", label: "Quantity column" },
  { key: "tax", label: "Tax column" },
  { key: "discount", label: "Discount" },
  { key: "paymentDetails", label: "Payment details" },
  { key: "notes", label: "Notes" },
  { key: "terms", label: "Terms" },
];

/**
 * The six checkboxes that pick which optional sections an invoice shows. Shared
 * by the Settings default and the per-invoice editor so both read identically.
 */
export function FieldToggles({
  value,
  onChange,
}: {
  value: InvoiceFieldPrefs;
  onChange: (next: InvoiceFieldPrefs) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {FIELDS.map((f) => (
        <label
          key={f.key}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
            className="size-4"
            style={{ accentColor: "var(--primary)" }}
          />
          <span>{f.label}</span>
        </label>
      ))}
    </div>
  );
}
