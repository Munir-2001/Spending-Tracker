"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert, Info, CircleCheck, X } from "lucide-react";

/**
 * A floating, dismissible notice for the dark marketing surfaces (landing, etc.).
 * Self-contained palette so it stays on-brand regardless of the app theme —
 * the app's themed Alert/Dialog would render light and clash here.
 */
const CREAM = "#F6F1E7";
const GOLD = "#E9B44C";

const TONES: Record<NoticeTone, string> = {
  error: "#DE8A6A",
  warning: "#E9B44C",
  info: "#8E86C9",
  success: "#54C3A4",
};
const ICONS = {
  error: TriangleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
} as const;

export type NoticeTone = "error" | "warning" | "info" | "success";

export function Notice({
  open,
  tone = "error",
  title,
  message,
  action,
  onDismiss,
}: {
  open: boolean;
  tone?: NoticeTone;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  onDismiss?: () => void;
}) {
  const color = TONES[tone];
  const Icon = ICONS[tone];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 24, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed inset-x-4 bottom-5 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{
            backgroundColor: "rgba(20,17,14,0.96)",
            border: `1px solid ${color}44`,
            boxShadow: "0 24px 60px -24px rgba(0,0,0,0.8)",
            color: CREAM,
          }}
        >
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            {message && (
              <p
                className="mt-0.5 text-xs leading-relaxed"
                style={{ color: `${CREAM}99` }}
              >
                {message}
              </p>
            )}
            {action && (
              <button
                onClick={action.onClick}
                disabled={action.disabled}
                className="mt-2 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
                style={{ color: GOLD }}
              >
                {action.label}
              </button>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="shrink-0 transition-opacity hover:opacity-100"
              style={{ color: `${CREAM}77` }}
            >
              <X className="size-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
