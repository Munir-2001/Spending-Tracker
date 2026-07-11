"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  type Variants,
} from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";

import { useAppData } from "@/components/transactions/transactions-provider";
import { wrappedStats, type WrappedStats } from "@/lib/compute";
import { formatMoney, formatFullDate } from "@/lib/format";
import { LedgerMark } from "@/components/logo";

const SLIDE_MS = 5200;

// One bold palette per beat — a deliberate departure from the muted app.
type Palette = { bg: string; fg: string; dim: string };
const PALETTES: Palette[] = [
  { bg: "#100E0B", fg: "#F6F1E7", dim: "rgba(246,241,231,0.55)" }, // intro
  { bg: "#E9B44C", fg: "#171207", dim: "rgba(23,18,7,0.62)" }, // total
  { bg: "#1F8A78", fg: "#EFFBF6", dim: "rgba(239,251,246,0.6)" }, // category
  { bg: "#E4603E", fg: "#25090B", dim: "rgba(37,9,11,0.6)" }, // splurge
  { bg: "#575C96", fg: "#F1F0FB", dim: "rgba(241,240,251,0.6)" }, // month
  { bg: "#A7C957", fg: "#141C06", dim: "rgba(20,28,6,0.62)" }, // savings
  { bg: "#100E0B", fg: "#F6F1E7", dim: "rgba(246,241,231,0.55)" }, // finale
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.12 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 180, damping: 20 },
  },
};

function CountUp({
  to,
  format,
}: {
  to: number;
  format: (n: number) => string;
}) {
  const mv = useMotionValue(0);
  const [text, setText] = useState(() => format(0));
  useEffect(() => {
    const controls = animate(mv, to, { duration: 1.5, ease: [0.16, 1, 0.3, 1] });
    const unsub = mv.on("change", (v) => setText(format(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="num tabular-nums">{text}</span>;
}

export function WrappedExperience() {
  const router = useRouter();
  const { items, categories, baseCurrency, fx } = useAppData();
  const period = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, []);
  const stats = useMemo(
    () => wrappedStats(items, categories, fx, period.year, period.month),
    [items, categories, fx, period]
  );

  const fmt = useCallback(
    (n: number) =>
      formatMoney(Math.round(n), { currency: baseCurrency, trimZeroCents: true }),
    [baseCurrency]
  );

  const close = useCallback(() => router.push("/dashboard"), [router]);

  const slides = useMemo(() => buildSlides(stats, fmt), [stats, fmt]);
  const [i, setI] = useState(0);
  const count = slides.length;

  const next = useCallback(
    () => setI((v) => (v + 1 < count ? v + 1 : v)),
    [count]
  );
  const prev = useCallback(() => setI((v) => (v > 0 ? v - 1 : v)), []);

  // Auto-advance (stops on the final slide).
  useEffect(() => {
    if (!stats.hasData) return;
    if (i >= count - 1) return;
    const id = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(id);
  }, [i, count, next, stats.hasData]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, next, prev]);

  if (!stats.hasData) {
    return (
      <Shell palette={PALETTES[0]} onClose={close}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Sparkles className="size-8 opacity-70" />
          <h1 className="display text-3xl tracking-tight">Nothing to wrap yet</h1>
          <p className="max-w-xs text-sm opacity-70">
            Log a few transactions this year and your Ledger Wrapped will be
            waiting.
          </p>
          <button
            onClick={close}
            className="mt-2 rounded-full bg-current px-5 py-2 text-sm font-medium"
          >
            <span className="mix-blend-difference">Back to Ledger</span>
          </button>
        </div>
      </Shell>
    );
  }

  const palette = slides[i].palette;

  return (
    <Shell palette={palette} onClose={close}>
      {/* Progress bars */}
      <div className="flex gap-1.5">
        {slides.map((_, idx) => (
          <div
            key={idx}
            className="h-[3px] flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: "color-mix(in oklab, currentColor 22%, transparent)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "currentColor" }}
              initial={{ width: idx < i ? "100%" : "0%" }}
              animate={{ width: idx < i ? "100%" : idx === i ? "100%" : "0%" }}
              transition={
                idx === i && i < count - 1
                  ? { duration: SLIDE_MS / 1000, ease: "linear" }
                  : { duration: 0.3 }
              }
            />
          </div>
        ))}
      </div>

      {/* Slide */}
      <div className="relative flex flex-1 items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="w-full"
          >
            {slides[i].content}
          </motion.div>
        </AnimatePresence>

        {/* Tap zones */}
        <button
          aria-label="Previous"
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
        />
        <button
          aria-label="Next"
          onClick={next}
          className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium opacity-70">
          <LedgerMark className="size-3.5" />
          Ledger Wrapped
        </span>
        {i < count - 1 ? (
          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: "color-mix(in oklab, currentColor 12%, transparent)" }}
          >
            Next <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={close}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: "color-mix(in oklab, currentColor 12%, transparent)" }}
          >
            Done
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  palette,
  onClose,
  children,
}: {
  palette: Palette;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col px-6 py-5 md:px-10 md:py-8"
      animate={{ backgroundColor: palette.bg, color: palette.fg }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      {/* soft vignette for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 40%, rgba(0,0,0,0.22) 100%)",
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-6">
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: "color-mix(in oklab, currentColor 12%, transparent)" }}
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

// ── Slides ───────────────────────────────────────────────────────────────────
type Slide = { palette: Palette; content: React.ReactNode };

function buildSlides(
  s: WrappedStats,
  fmt: (n: number) => string
): Slide[] {
  const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <motion.p
      variants={item}
      className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70"
    >
      {children}
    </motion.p>
  );

  const slides: Slide[] = [];

  // 1 — Intro
  slides.push({
    palette: PALETTES[0],
    content: (
      <div className="space-y-5">
        <motion.div variants={item}>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#E9B44C] text-[#171207]">
            <LedgerMark className="size-6" />
          </span>
        </motion.div>
        <motion.h1
          variants={item}
          className="display text-5xl leading-[0.95] tracking-tight md:text-6xl"
        >
          Your {s.label},<br />
          <span className="text-[#E9B44C]">wrapped.</span>
        </motion.h1>
        <motion.p variants={item} className="max-w-xs text-sm opacity-70">
          A look back at where your money went this month — the habits, the
          splurges, the wins.
        </motion.p>
      </div>
    ),
  });

  // 2 — Total tracked
  slides.push({
    palette: PALETTES[1],
    content: (
      <div className="space-y-4">
        <Eyebrow>You tracked</Eyebrow>
        <motion.p
          variants={item}
          className="display text-6xl leading-none tracking-tight md:text-7xl"
        >
          <CountUp to={s.totalSpent} format={fmt} />
        </motion.p>
        <motion.p variants={item} className="text-lg">
          across{" "}
          <span className="num font-semibold">{s.txnCount}</span> transactions.
        </motion.p>
      </div>
    ),
  });

  // 3 — Top category
  if (s.topCategories.length) {
    const top = s.topCategories[0];
    slides.push({
      palette: PALETTES[2],
      content: (
        <div className="space-y-5">
          <Eyebrow>Your biggest habit</Eyebrow>
          <motion.p
            variants={item}
            className="display text-5xl leading-none tracking-tight md:text-6xl"
          >
            {top.label}
          </motion.p>
          <motion.p variants={item} className="text-lg">
            <span className="num font-semibold">{fmt(top.amount)}</span> —{" "}
            {Math.round(top.share * 100)}% of everything you spent.
          </motion.p>
          <motion.div variants={item} className="space-y-2 pt-2">
            {s.topCategories.slice(0, 4).map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(6, c.share * 100)}%`,
                    backgroundColor: "currentColor",
                    opacity: 0.9,
                  }}
                />
                <span className="shrink-0 text-xs opacity-80">{c.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      ),
    });
  }

  // 4 — Biggest splurge
  if (s.biggestSplurge) {
    slides.push({
      palette: PALETTES[3],
      content: (
        <div className="space-y-4">
          <Eyebrow>Your biggest single moment</Eyebrow>
          <motion.p
            variants={item}
            className="display text-5xl leading-none tracking-tight md:text-6xl"
          >
            {s.biggestSplurge.merchant}
          </motion.p>
          <motion.p variants={item} className="num text-3xl font-semibold">
            {fmt(s.biggestSplurge.amount)}
          </motion.p>
          <motion.p variants={item} className="text-sm opacity-70">
            on {formatFullDate(s.biggestSplurge.date)}. No judgment.
          </motion.p>
        </div>
      ),
    });
  }

  // 5 — Busiest day
  if (s.busiestDay) {
    slides.push({
      palette: PALETTES[4],
      content: (
        <div className="space-y-4">
          <Eyebrow>Your heaviest day</Eyebrow>
          <motion.p
            variants={item}
            className="display text-4xl leading-tight tracking-tight md:text-5xl"
          >
            {formatFullDate(s.busiestDay.date)}
          </motion.p>
          <motion.p variants={item} className="text-lg">
            You spent{" "}
            <span className="num font-semibold">{fmt(s.busiestDay.amount)}</span>{" "}
            in a single day.
          </motion.p>
        </div>
      ),
    });
  }

  // 6 — Savings rate (only if there was income)
  if (s.savingsRate !== null) {
    const pct = Math.round(s.savingsRate * 100);
    slides.push({
      palette: PALETTES[5],
      content: (
        <div className="space-y-4">
          <Eyebrow>You kept</Eyebrow>
          <motion.p
            variants={item}
            className="display text-7xl leading-none tracking-tight md:text-8xl"
          >
            <CountUp to={pct} format={(n) => `${Math.round(n)}%`} />
          </motion.p>
          <motion.p variants={item} className="text-lg">
            of every {fmt(s.totalIncome)} that came in.{" "}
            {pct >= 20 ? "Seriously good." : "Room to grow — you've got this."}
          </motion.p>
        </div>
      ),
    });
  }

  // 7 — Finale card
  slides.push({
    palette: PALETTES[6],
    content: (
      <div className="space-y-5">
        <Eyebrow>Your year in one card</Eyebrow>
        <motion.div
          variants={item}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#E9B44C] text-[#171207]">
              <LedgerMark className="size-4" />
            </span>
            <span className="display text-lg">Ledger · {s.label}</span>
          </div>
          <FinaleRow label="Tracked" value={fmt(s.totalSpent)} />
          <FinaleRow label="Transactions" value={String(s.txnCount)} />
          {s.topCategories[0] && (
            <FinaleRow label="Top habit" value={s.topCategories[0].label} />
          )}
          {s.busiestDay && (
            <FinaleRow
              label="Heaviest day"
              value={formatFullDate(s.busiestDay.date)}
            />
          )}
          {s.savingsRate !== null && (
            <FinaleRow
              label="Kept"
              value={`${Math.round(s.savingsRate * 100)}%`}
            />
          )}
        </motion.div>
        <motion.p variants={item} className="text-center text-xs opacity-60">
          Onwards to a sharper month. 🥂
        </motion.p>
      </div>
    ),
  });

  return slides;
}

function FinaleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm first:border-0 first:pt-0">
      <span className="opacity-60">{label}</span>
      <span className="num font-semibold">{value}</span>
    </div>
  );
}