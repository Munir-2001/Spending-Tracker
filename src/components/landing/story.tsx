"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  animate,
  useInView,
  useMotionValue,
  type Variants,
} from "framer-motion";
import {
  Check,
  CreditCard,
  Landmark,
  Coins,
  Banknote,
  Bitcoin,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Home,
  UtensilsCrossed,
} from "lucide-react";

const CREAM = "#F6F1E7";
const GOLD = "#E9B44C";
const GREEN = "#9BB56B";
const RED = "#DE8A6A";
const VIOLET = "#8E86C9";
const EMERALD = "#54C3A4";
const CORAL = "#E4603E";

const card = {
  backgroundColor: "rgba(246,241,231,0.045)",
  border: "1px solid rgba(246,241,231,0.09)",
  boxShadow: "0 26px 50px -28px rgba(0,0,0,0.65)",
} as const;

const rise: Variants = {
  hidden: { opacity: 0, x: 26 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Count from 0 → `to` the first time it scrolls into view. */
function Count({
  to,
  prefix = "",
  suffix = "",
}: {
  to: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, { duration: 1.3, ease: [0.16, 1, 0.3, 1] });
    const unsub = mv.on("change", (v) => setN(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [inView, to]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className="num tabular-nums">
      {prefix}
      {Math.round(n).toLocaleString()}
      {suffix}
    </span>
  );
}

const STEPS = [
  {
    n: "01",
    accent: GOLD,
    title: "Every account, one honest view.",
    points: [
      "Banks, cash, crypto and gold — together, in any currency.",
      "Balances update the instant you log a transaction.",
      "Nested accounts roll up into a single net worth.",
    ],
    visual: <AccountsVisual />,
  },
  {
    n: "02",
    accent: EMERALD,
    title: "Real assets, valued live.",
    points: [
      "Property, gold, crypto and investments — tracked as you own them.",
      "Gold priced from the live spot, with profit & loss.",
      "Everything you hold, folded into one number.",
    ],
    visual: <AssetsVisual />,
  },
  {
    n: "03",
    accent: VIOLET,
    title: "Watch your net worth take shape.",
    points: [
      "A living picture of income, spending and net worth.",
      "See exactly where money comes from — and where it goes.",
      "No spreadsheets. No guesswork.",
    ],
    visual: <ChartVisual accent={VIOLET} />,
  },
  {
    n: "04",
    accent: CORAL,
    title: "Spend with intention, not anxiety.",
    points: [
      "Set budgets that quietly keep you on track.",
      "Know what's safe to spend today.",
      "End the month with a story — your spending, wrapped.",
    ],
    visual: <BudgetVisual />,
  },
];

export function StorySteps() {
  return (
    <section id="how" className="mx-auto max-w-5xl px-6 py-24 md:px-10 md:py-32">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="num mb-20 text-[11px] uppercase tracking-[0.34em]"
        style={{ color: `${CREAM}66` }}
      >
        How it works
      </motion.p>

      <div className="flex flex-col gap-6 md:gap-8">
        {STEPS.map((s, i) => (
          <Step key={s.n} step={s} reverse={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function Step({
  step,
  reverse,
}: {
  step: (typeof STEPS)[number];
  reverse: boolean;
}) {
  const accent = step.accent;
  return (
    <motion.div
      initial={{ opacity: 0, x: reverse ? 80 : -80 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[1.9rem] px-7 py-14 md:px-16 md:py-20"
      style={{
        backgroundColor: "rgba(246,241,231,0.03)",
        border: `1px solid ${CREAM}12`,
        boxShadow: "0 44px 100px -60px rgba(0,0,0,0.9)",
      }}
    >
      {/* accent glow near the number for a pop of contrast */}
      <span
        aria-hidden
        className="pointer-events-none absolute size-80 rounded-full"
        style={{
          background: `radial-gradient(circle, ${accent}2e 0%, transparent 70%)`,
          top: "-5rem",
          left: reverse ? undefined : "-4rem",
          right: reverse ? "-4rem" : undefined,
        }}
      />
      {/* faint top highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${CREAM}22, transparent)` }}
      />
      {/* giant watermark number in the step's accent */}
      <span
        aria-hidden
        className="display pointer-events-none absolute -top-12 select-none text-[11rem] leading-none md:text-[15rem]"
        style={{
          color: accent,
          opacity: 0.13,
          left: reverse ? undefined : "-0.5rem",
          right: reverse ? "-0.5rem" : undefined,
        }}
      >
        {step.n[1]}
      </span>

      <div className="relative grid items-center gap-10 md:grid-cols-2 md:gap-14">
        {/* text */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.09 } } }}
          className={reverse ? "md:order-2" : ""}
        >
        <motion.p
          variants={rise}
          className="num text-[11px] uppercase tracking-[0.3em]"
          style={{ color: accent }}
        >
          Step {step.n}
        </motion.p>
        <motion.h3
          variants={rise}
          className="display mt-4 max-w-md text-3xl leading-[1.05] tracking-tight md:text-4xl"
        >
          {step.title}
        </motion.h3>
        <ul className="mt-8 space-y-4">
          {step.points.map((p) => (
            <motion.li
              key={p}
              variants={rise}
              className="flex items-start gap-3 text-[15px] leading-relaxed"
              style={{ color: `${CREAM}b0` }}
            >
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accent}26`, color: accent }}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>
        </motion.div>

        {/* visual */}
        <div className={reverse ? "md:order-1" : ""}>{step.visual}</div>
      </div>
    </motion.div>
  );
}

// ── Visual 1 · account cards that deal in ────────────────────────────────────
function AccountsVisual() {
  const accts = [
    { icon: CreditCard, name: "Amex Card", sub: "EUR · debit", bal: "€1,480.00", tone: CREAM },
    { icon: Landmark, name: "CitiBank", sub: "USD · bank", bal: "$12,850", tone: CREAM },
    { icon: Coins, name: "Gold", sub: "2 tola · 24k", bal: "▲ 12.4%", tone: GREEN },
    { icon: Banknote, name: "Cash Wallet", sub: "EUR · cash", bal: "€280.00", tone: CREAM },
  ];
  return (
    <div className="flex flex-col gap-3" style={{ perspective: "1000px" }}>
      {accts.map((a, i) => {
        const Icon = a.icon;
        return (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, y: 26, rotateX: 10 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ z: 26, scale: 1.02 }}
            style={{ ...card, transformPerspective: 1000 }}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${CREAM}0f`, color: `${CREAM}aa` }}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: CREAM }}>
                {a.name}
              </p>
              <p className="text-xs" style={{ color: `${CREAM}66` }}>
                {a.sub}
              </p>
            </div>
            <span className="num text-sm font-semibold tabular-nums" style={{ color: a.tone }}>
              {a.bal}
            </span>
          </motion.div>
        );
      })}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="rounded-2xl border border-dashed py-3 text-center text-xs"
        style={{ borderColor: `${CREAM}24`, color: `${CREAM}66` }}
      >
        + Add account or wallet
      </motion.div>
    </div>
  );
}

// ── Visual · assets, valued live ─────────────────────────────────────────────
function AssetsVisual() {
  const others = [
    { icon: Home, name: "Apartment", sub: "property", val: "€185,000", pl: null },
    { icon: Bitcoin, name: "Bitcoin", sub: "0.4 BTC", val: "€26,800", pl: "▲ 5.2%" },
  ];
  const sp = [[0, 20], [16, 14], [32, 17], [48, 8], [64, 11], [80, 3]];
  const spLine = sp.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");

  return (
    <div className="flex flex-col gap-3">
      {/* featured: live gold */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={card}
        className="relative overflow-hidden rounded-2xl p-4"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full"
          style={{ background: `radial-gradient(circle, ${GOLD}3a, transparent 70%)` }}
        />
        <div className="relative flex items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
          >
            <Coins className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: CREAM }}>
              Gold
            </p>
            <p className="text-xs" style={{ color: `${CREAM}66` }}>
              2 tola · 24k
            </p>
          </div>
          <span
            className="num rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: `${GREEN}22`, color: GREEN }}
          >
            ▲ 12.4%
          </span>
        </div>
        <div className="relative mt-3 flex items-end justify-between">
          <span className="num text-2xl font-semibold" style={{ color: CREAM }}>
            $3,880
          </span>
          <svg viewBox="0 0 80 24" width="80" height="24">
            <motion.path
              d={spLine}
              fill="none"
              stroke={GOLD}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.3 }}
            />
          </svg>
        </div>
      </motion.div>

      {others.map((a, i) => {
        const Icon = a.icon;
        return (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: 0.12 + i * 0.1 }}
            style={card}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${CREAM}0f`, color: `${CREAM}aa` }}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: CREAM }}>
                {a.name}
              </p>
              <p className="text-xs" style={{ color: `${CREAM}66` }}>
                {a.sub}
              </p>
            </div>
            <div className="text-right">
              <p className="num text-sm font-semibold" style={{ color: CREAM }}>
                {a.val}
              </p>
              {a.pl && (
                <p className="num text-[11px]" style={{ color: GREEN }}>
                  {a.pl}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="rounded-2xl border border-dashed py-3 text-center text-xs"
        style={{ borderColor: `${EMERALD}33`, color: `${CREAM}66` }}
      >
        Rolls into your net worth
      </motion.div>
    </div>
  );
}

// ── Visual 2 · net-worth chart that draws itself ─────────────────────────────
function ChartVisual({ accent = GOLD }: { accent?: string }) {
  const pts = [
    [0, 132], [52, 104], [104, 118], [156, 74], [208, 90], [260, 44], [312, 56],
  ];
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L312,168 L0,168 Z`;
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];

  return (
    <div className="relative rounded-2xl p-5" style={card}>
      <div className="mb-1 flex items-center gap-2.5">
        <span
          className="flex size-7 items-center justify-center rounded-lg text-[13px]"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          ◗
        </span>
        <div>
          <p className="text-xs" style={{ color: `${CREAM}66` }}>
            Net worth · last 6 months
          </p>
          <p className="num text-lg font-semibold" style={{ color: CREAM }}>
            <Count to={12480} prefix="€" />
          </p>
        </div>
      </div>

      <svg viewBox="0 0 312 178" className="mt-2 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill="url(#nw)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.7 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="mt-2 flex justify-between text-[10px]" style={{ color: `${CREAM}44` }}>
        {months.map((m) => (
          <span key={m} className="num">
            {m}
          </span>
        ))}
      </div>

      {/* floating stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute right-4 top-[42%] flex flex-col gap-2"
      >
        <StatChip icon={ArrowUpRight} tone={GREEN} label="This month" value="+€3,200" />
        <StatChip icon={ArrowDownRight} tone={RED} label="Spent" value="−€1,584" />
      </motion.div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof ArrowUpRight;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2"
      style={{ backgroundColor: "rgba(16,14,11,0.82)", border: `1px solid ${CREAM}12` }}
    >
      <span
        className="flex size-6 items-center justify-center rounded-full"
        style={{ backgroundColor: `${tone}26`, color: tone }}
      >
        <Icon className="size-3.5" />
      </span>
      <div>
        <p className="text-[10px]" style={{ color: `${CREAM}66` }}>
          {label}
        </p>
        <p className="num text-xs font-semibold" style={{ color: CREAM }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Visual 3 · budget bars that fill ─────────────────────────────────────────
function BudgetVisual() {
  const rows = [
    { icon: ShoppingBag, name: "Groceries", amt: "€420", pct: 62, color: GOLD },
    { icon: Home, name: "Rent", amt: "€1,200", pct: 45, color: GREEN },
    { icon: UtensilsCrossed, name: "Dining", amt: "€180", pct: 78, color: RED },
    { icon: CreditCard, name: "Transport", amt: "€96", pct: 34, color: VIOLET },
  ];
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const Icon = r.icon;
        return (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            style={card}
            className="rounded-2xl px-4 py-3.5"
          >
            <div className="mb-2.5 flex items-center gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${r.color}26`, color: r.color }}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="flex-1 text-sm font-medium" style={{ color: CREAM }}>
                {r.name}
              </span>
              <span className="num text-sm" style={{ color: `${CREAM}88` }}>
                {r.amt}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: `${CREAM}12` }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: r.color }}
                initial={{ width: "0%" }}
                whileInView={{ width: `${r.pct}%` }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="num mt-1.5 text-[11px]" style={{ color: r.color }}>
              <Count to={r.pct} suffix="% used" />
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
