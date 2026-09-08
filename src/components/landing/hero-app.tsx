"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  animate,
  useMotionValue,
  type Variants,
} from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  LineChart as LineIcon,
  ArrowLeftRight,
  PieChart as PieIcon,
  Activity,
  FileText,
  Landmark,
  Coins,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Banknote,
  Bitcoin,
  Home,
  Check,
} from "lucide-react";

/**
 * The interactive hero — a real, clickable, scrollable slice of Ledger rendered
 * as a light "app window" floating on the dark landing. Charts use Recharts (the
 * same lib the real app uses) so they get true axes + hover tooltips. Fake but
 * believable data; zero backend.
 */

const C = {
  surface: "#FBFAF6",
  panel: "#FFFFFF",
  ink: "#1A1712",
  soft: "#6F6A5E",
  faint: "#A39D90",
  line: "#ECE7DB",
  gold: "#C98A1E",
  goldBg: "#F6EAD0",
  green: "#4F8F5E",
  red: "#CC6A44",
  v1: "#8E86C9",
  v2: "#54A3A4",
  v3: "#E4603E",
  v4: "#6B8FCB",
  v5: "#C98A1E",
} as const;

type ViewKey =
  | "networth"
  | "transactions"
  | "insights"
  | "cashflow"
  | "invoicing"
  | "accounts"
  | "assets";

const NAV: { key: ViewKey; label: string; icon: typeof LineIcon }[] = [
  { key: "networth", label: "Net worth", icon: LineIcon },
  { key: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { key: "insights", label: "Insights", icon: PieIcon },
  { key: "cashflow", label: "Cash flow", icon: Activity },
  { key: "invoicing", label: "Invoicing", icon: FileText },
  { key: "accounts", label: "Accounts", icon: Landmark },
  { key: "assets", label: "Assets", icon: Coins },
];

export function HeroApp() {
  const [view, setView] = useState<ViewKey>("networth");
  const [hidden, setHidden] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        backgroundColor: C.surface,
        color: C.ink,
        boxShadow:
          "0 50px 90px -40px rgba(0,0,0,0.65), 0 8px 24px -12px rgba(0,0,0,0.4)",
        transformPerspective: 1200,
      }}
      className="w-full overflow-hidden rounded-2xl"
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: C.line }}>
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: "#E4603E" }} />
          <span className="size-2.5 rounded-full" style={{ background: "#E9B44C" }} />
          <span className="size-2.5 rounded-full" style={{ background: "#5EA96B" }} />
        </span>
        <span
          className="rounded-full px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: C.goldBg, color: C.gold }}
        >
          Interactive preview
        </span>
        <span
          className="mx-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px]"
          style={{ background: C.surface, color: C.faint, border: `1px solid ${C.line}` }}
        >
          <LedgerGlyph /> app.ledger.money
        </span>
        <motion.button
          onClick={() => setHidden((h) => !h)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
          style={{ color: C.soft }}
          aria-label="Toggle privacy"
        >
          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </motion.button>
      </div>

      {/* body: rail + view */}
      <div className="flex h-[468px]">
        <nav
          className="flex w-[152px] shrink-0 flex-col gap-0.5 border-r p-2.5"
          style={{ borderColor: C.line, background: C.surface }}
        >
          <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>
            Ledger
          </div>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.key === view;
            return (
              <motion.button
                key={n.key}
                onClick={() => setView(n.key)}
                whileHover={{ x: 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px]"
                style={{
                  background: active ? C.goldBg : "transparent",
                  color: active ? C.gold : C.soft,
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="relative min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="p-5"
            >
              {view === "networth" && <NetWorthView hidden={hidden} />}
              {view === "transactions" && <TransactionsView hidden={hidden} />}
              {view === "insights" && <InsightsView hidden={hidden} />}
              {view === "cashflow" && <CashflowView hidden={hidden} />}
              {view === "invoicing" && <InvoicingView hidden={hidden} />}
              {view === "accounts" && <AccountsView hidden={hidden} />}
              {view === "assets" && <AssetsView hidden={hidden} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────

function Money({ children, hidden }: { children: React.ReactNode; hidden?: boolean }) {
  return (
    <span className="num tabular-nums" style={hidden ? { filter: "blur(7px)", userSelect: "none" } : undefined}>
      {children}
    </span>
  );
}

function ViewHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="num text-[10px] uppercase tracking-[0.18em]" style={{ color: C.faint }}>
        {eyebrow}
      </p>
      <h3 className="display mt-1 text-lg leading-none" style={{ color: C.ink }}>
        {title}
      </h3>
    </div>
  );
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const rise: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

const hoverCard = {
  whileHover: { scale: 1.015, y: -1 },
  transition: { type: "spring" as const, stiffness: 380, damping: 24 },
};

function Count({ to, prefix = "" }: { to: number; prefix?: string }) {
  const mv = useMotionValue(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const controls = animate(mv, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    const unsub = mv.on("change", (v) => setN(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {prefix}
      {Math.round(n).toLocaleString()}
    </>
  );
}

// A compact, on-brand recharts tooltip.
function Tip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-2.5 py-1.5 text-[11px] shadow-sm"
      style={{ background: C.panel, borderColor: C.line, color: C.ink }}
    >
      {label && <p className="num mb-0.5" style={{ color: C.faint }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="num flex items-center gap-1.5 font-medium">
          <span className="size-1.5 rounded-full" style={{ background: p.color }} />
          {p.name ? `${p.name}: ` : ""}
          {fmt(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

// ── 1 · Net worth ────────────────────────────────────────────────────────────

const NW = [
  { m: "Mar", v: 41.2 },
  { m: "Apr", v: 43.0 },
  { m: "May", v: 42.4 },
  { m: "Jun", v: 46.1 },
  { m: "Jul", v: 45.3 },
  { m: "Aug", v: 49.0 },
  { m: "Sep", v: 52.2 },
];

function NetWorthView({ hidden }: { hidden: boolean }) {
  const breakdown = [
    { label: "Cash", pct: 42, color: C.v4 },
    { label: "Investments", pct: 31, color: C.v2 },
    { label: "Gold", pct: 18, color: C.gold },
    { label: "Crypto", pct: 9, color: C.v1 },
  ];
  return (
    <div>
      <ViewHead eyebrow="Everything you own & owe" title="Net worth" />
      <div className="flex items-end justify-between">
        <div>
          <p className="display text-3xl leading-none" style={{ color: C.ink }}>
            <Money hidden={hidden}>€<Count to={52180} /></Money>
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[12px]" style={{ color: C.green }}>
            <ArrowUpRight className="size-3.5" />
            <Money hidden={hidden}>€2,340</Money> this month
          </p>
        </div>
        <span className="num text-[11px]" style={{ color: C.faint }}>6 accounts · 2 currencies</span>
      </div>

      <div className="mt-3 h-[132px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={NW} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.gold} stopOpacity={0.26} />
                <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
            <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: C.faint }} dy={4} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fontSize: 10, fill: C.faint }}
              tickFormatter={(v) => `€${v}k`}
              domain={[38, 54]}
              ticks={[40, 44, 48, 52]}
            />
            <Tooltip content={<Tip fmt={(v) => `€${v.toFixed(1)}k`} />} cursor={{ stroke: C.line }} />
            <Area
              dataKey="v"
              type="monotone"
              stroke={C.gold}
              strokeWidth={2}
              fill="url(#nwFill)"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: C.gold }}
              isAnimationActive
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-medium" style={{ color: C.soft }}>What it&apos;s made of</p>
        {breakdown.map((b) => (
          <div key={b.label} className="flex items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: b.color }} />
            <span className="w-24 text-[12px]" style={{ color: C.ink }}>{b.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: C.line }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: b.color }}
                initial={{ width: 0 }}
                animate={{ width: `${b.pct}%` }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="num w-8 text-right text-[11px]" style={{ color: C.faint }}>{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2 · Transactions ─────────────────────────────────────────────────────────

function TransactionsView({ hidden }: { hidden: boolean }) {
  const rows = [
    { m: "Salary", c: "Income", d: "Sep 1", a: "+€3,200.00", tone: C.green, dot: C.green },
    { m: "Upwork payout", c: "Income · USD", d: "Sep 4", a: "+$1,850.00", tone: C.green, dot: C.green },
    { m: "Flixbus", c: "Transport", d: "Sep 6", a: "−€28.80", tone: C.ink, dot: C.v1 },
    { m: "AWS", c: "Software · USD", d: "Sep 5", a: "−$42.00", tone: C.ink, dot: C.v4 },
    { m: "Esselunga", c: "Groceries", d: "Aug 31", a: "−€52.14", tone: C.ink, dot: C.v2 },
    { m: "Netflix", c: "Subscriptions", d: "Aug 30", a: "−€12.99", tone: C.ink, dot: C.v3 },
  ];
  return (
    <div>
      <ViewHead eyebrow="Every account, one view" title="Transactions" />
      <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-0.5">
        {rows.map((r) => (
          <motion.li
            key={r.m}
            variants={rise}
            whileHover={{ scale: 1.015, backgroundColor: C.surface }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className="flex cursor-default items-center gap-3 rounded-lg px-2 py-2"
            style={{ borderBottom: `1px solid ${C.line}` }}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ background: `${r.dot}22`, color: r.dot }}
            >
              {r.m.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium" style={{ color: C.ink }}>{r.m}</p>
              <p className="text-[11px]" style={{ color: C.faint }}>{r.c} · {r.d}</p>
            </div>
            <span className="num text-[12.5px] font-medium" style={{ color: r.tone }}>
              <Money hidden={hidden}>{r.a}</Money>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

// ── 3 · Insights (hoverable donut) ───────────────────────────────────────────

const CATS = [
  { label: "Housing", value: 1200, color: C.v4 },
  { label: "Groceries", value: 420, color: C.v2 },
  { label: "Dining", value: 180, color: C.v3 },
  { label: "Transport", value: 96, color: C.v1 },
  { label: "Other", value: 140, color: C.gold },
];
const CATS_TOTAL = CATS.reduce((s, c) => s + c.value, 0);

function InsightsView({ hidden }: { hidden: boolean }) {
  const [active, setActive] = useState(0);
  const a = CATS[active];
  return (
    <div>
      <ViewHead eyebrow="Where it goes" title="Insights" />
      <div className="flex items-center gap-4">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={CATS}
                dataKey="value"
                nameKey="label"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
                onMouseEnter={(_, i) => setActive(i)}
              >
                {CATS.map((c, i) => (
                  <Cell key={c.label} fill={c.color} opacity={active === i ? 1 : 0.45} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px]" style={{ color: C.faint }}>{a.label}</span>
            <span className="num text-sm font-semibold" style={{ color: C.ink }}>
              <Money hidden={hidden}>€{a.value.toLocaleString()}</Money>
            </span>
            <span className="num text-[10px]" style={{ color: C.faint }}>
              {Math.round((a.value / CATS_TOTAL) * 100)}%
            </span>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5">
          {CATS.map((c, i) => (
            <li
              key={c.label}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors"
              style={{ background: active === i ? C.surface : "transparent" }}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="flex-1" style={{ color: C.ink }}>{c.label}</span>
              <span className="num" style={{ color: C.soft }}>
                <Money hidden={hidden}>€{c.value.toLocaleString()}</Money>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-xl px-3.5 py-2.5" style={{ background: C.goldBg }}>
        <p className="text-[12px] leading-snug" style={{ color: "#7A5A16" }}>
          You saved <span className="font-semibold">34% more</span> than last month — your best September yet.
        </p>
      </div>
    </div>
  );
}

// ── 4 · Cash flow (line chart) ───────────────────────────────────────────────

const CF = [
  { m: "Apr", income: 4200, spending: 3100 },
  { m: "May", income: 3900, spending: 3400 },
  { m: "Jun", income: 4600, spending: 2900 },
  { m: "Jul", income: 4300, spending: 3600 },
  { m: "Aug", income: 4800, spending: 3050 },
  { m: "Sep", income: 5050, spending: 2870 },
];

function CashflowView({ hidden }: { hidden: boolean }) {
  return (
    <div>
      <ViewHead eyebrow="Income vs spending" title="Cash flow" />
      <div className="flex items-center gap-4 text-[11px]" style={{ color: C.soft }}>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.green }} /> Income</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.red }} /> Spending</span>
      </div>
      <div className="mt-2 h-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={CF} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
            <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: C.faint }} dy={4} />
            <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 10, fill: C.faint }} tickFormatter={(v) => `€${v / 1000}k`} domain={[2000, 5500]} ticks={[2000, 3000, 4000, 5000]} />
            <Tooltip content={<Tip fmt={(v) => `€${v.toLocaleString()}`} />} cursor={{ stroke: C.line }} />
            <Line dataKey="income" name="Income" type="monotone" stroke={C.green} strokeWidth={2} dot={{ r: 2, fill: C.green, strokeWidth: 0 }} activeDot={{ r: 4 }} animationDuration={1100} />
            <Line dataKey="spending" name="Spending" type="monotone" stroke={C.red} strokeWidth={2} dot={{ r: 2, fill: C.red, strokeWidth: 0 }} activeDot={{ r: 4 }} animationDuration={1100} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2.5 text-[12px]" style={{ borderColor: C.line }}>
        <span style={{ color: C.soft }}>Net this month</span>
        <span className="num font-semibold" style={{ color: C.green }}>
          <Money hidden={hidden}>+€2,180</Money>
        </span>
      </div>
    </div>
  );
}

// ── 5 · Invoicing (detailed, with tax) ───────────────────────────────────────

function InvoicingView({ hidden }: { hidden: boolean }) {
  const lines = [
    { d: "Design retainer — September", q: 1, r: "€2,500", tax: "22%", a: "€2,500.00" },
    { d: "UI revisions", q: 2, r: "€250", tax: "22%", a: "€500.00" },
    { d: "Brand consultation", q: 3, r: "€120", tax: "10%", a: "€360.00" },
  ];
  return (
    <div>
      <ViewHead eyebrow="Get paid" title="Invoicing" />
      <motion.div {...hoverCard} className="rounded-xl border p-4" style={{ borderColor: C.line, background: C.panel }}>
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="display text-[14px]" style={{ color: C.ink }}>LEDGER</p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed" style={{ color: C.faint }}>
              Munir Abbasi · munir@ledger.money<br />VAT IT0123456 0123
            </p>
          </div>
          <div className="text-right">
            <p className="num text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.ink }}>Invoice</p>
            <p className="num text-[10px]" style={{ color: C.faint }}>#INV-0042</p>
            <p className="num mt-1 text-[9.5px]" style={{ color: C.faint }}>Issued Sep 8, 2026<br />Due Sep 22, 2026</p>
          </div>
        </div>

        {/* bill to */}
        <div className="mt-3 rounded-lg px-2.5 py-2 text-[10px]" style={{ background: C.surface }}>
          <span className="uppercase tracking-wide" style={{ color: C.faint }}>Bill to</span>
          <p className="mt-0.5 text-[11px] font-medium" style={{ color: C.ink }}>Acme Studio S.r.l.</p>
          <p style={{ color: C.soft }}>Via Roma 12, Milano · VAT IT0987654 3210</p>
        </div>

        {/* line table */}
        <table className="mt-3 w-full" style={{ color: C.ink }}>
          <thead>
            <tr className="text-[9px] uppercase tracking-wide" style={{ color: C.faint }}>
              <th className="pb-1 text-left font-medium">Description</th>
              <th className="pb-1 text-right font-medium">Qty</th>
              <th className="pb-1 text-right font-medium">Rate</th>
              <th className="pb-1 text-right font-medium">Tax</th>
              <th className="pb-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="num text-[10.5px]">
            {lines.map((l) => (
              <tr key={l.d} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-1 pr-2 text-left">{l.d}</td>
                <td className="py-1 text-right" style={{ color: C.soft }}>{l.q}</td>
                <td className="py-1 text-right" style={{ color: C.soft }}>{l.r}</td>
                <td className="py-1 text-right" style={{ color: C.soft }}>{l.tax}</td>
                <td className="py-1 text-right"><Money hidden={hidden}>{l.a}</Money></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-2 ml-auto w-[62%] space-y-0.5 border-t pt-2 text-[10.5px]" style={{ borderColor: C.line }}>
          <Row label="Subtotal" value="€3,360.00" hidden={hidden} />
          <Row label="VAT · 22%" value="€660.00" muted hidden={hidden} />
          <Row label="VAT · 10%" value="€36.00" muted hidden={hidden} />
          <div className="mt-1 flex items-center justify-between border-t pt-1.5" style={{ borderColor: C.line }}>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: C.faint }}>Total due</span>
            <span className="display num text-[15px]" style={{ color: C.ink }}>
              <Money hidden={hidden}>€4,056.00</Money>
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[9.5px]" style={{ color: C.faint }}>Payable within 14 days · IBAN IT60 X054 …</span>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${C.green}1e`, color: C.green }}>
            <Check className="size-3" /> Paid
          </span>
        </div>
      </motion.div>
      <p className="mt-2.5 text-center text-[11px]" style={{ color: C.faint }}>
        Per-line tax · PDF export · marked paid posts income automatically.
      </p>
    </div>
  );
}

function Row({ label, value, muted, hidden }: { label: string; value: string; muted?: boolean; hidden?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: muted ? C.faint : C.soft }}>{label}</span>
      <span className="num" style={{ color: muted ? C.soft : C.ink }}>
        <Money hidden={hidden}>{value}</Money>
      </span>
    </div>
  );
}

// ── 6 · Accounts ─────────────────────────────────────────────────────────────

function AccountsView({ hidden }: { hidden: boolean }) {
  const rows = [
    { icon: Landmark, n: "Standard Chartered", s: "EUR · bank", a: "€12,850.00", tone: C.ink },
    { icon: CreditCard, n: "Amex Platinum", s: "EUR · card", a: "−€1,480.00", tone: C.red },
    { icon: Banknote, n: "Chase Checking", s: "USD · bank", a: "$8,420.00", tone: C.ink },
    { icon: Banknote, n: "Cash wallet", s: "EUR · cash", a: "€280.00", tone: C.ink },
  ];
  return (
    <div>
      <ViewHead eyebrow="Balances across institutions" title="Accounts" />
      <div className="space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <motion.div
              key={r.n}
              {...hoverCard}
              className="flex cursor-default items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{ borderColor: C.line, background: C.panel }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: C.surface, color: C.soft }}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium" style={{ color: C.ink }}>{r.n}</p>
                <p className="text-[11px]" style={{ color: C.faint }}>{r.s}</p>
              </div>
              <span className="num text-[12.5px] font-medium" style={{ color: r.tone }}>
                <Money hidden={hidden}>{r.a}</Money>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── 7 · Assets ───────────────────────────────────────────────────────────────

function AssetsView({ hidden }: { hidden: boolean }) {
  const rows = [
    { icon: Coins, n: "Gold", s: "2 tola · 24k", a: "€3,880", pl: "12.4%", up: true, accent: C.gold },
    { icon: Bitcoin, n: "Bitcoin", s: "0.4 BTC", a: "€26,800", pl: "5.2%", up: true, accent: C.v5 },
    { icon: Home, n: "Apartment", s: "property", a: "€185,000", pl: null, up: true, accent: C.v4 },
    { icon: Coins, n: "Ethereum", s: "3 ETH", a: "€7,200", pl: "2.1%", up: false, accent: C.v1 },
  ];
  return (
    <div>
      <ViewHead eyebrow="Valued live" title="Assets" />
      <div className="space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <motion.div
              key={r.n}
              {...hoverCard}
              className="flex cursor-default items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{ borderColor: C.line, background: C.panel }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${r.accent}18`, color: r.accent }}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium" style={{ color: C.ink }}>{r.n}</p>
                <p className="text-[11px]" style={{ color: C.faint }}>{r.s}</p>
              </div>
              <div className="text-right">
                <p className="num text-[12.5px] font-medium" style={{ color: C.ink }}>
                  <Money hidden={hidden}>{r.a}</Money>
                </p>
                {r.pl && (
                  <p className="num flex items-center justify-end gap-0.5 text-[10.5px]" style={{ color: r.up ? C.green : C.red }}>
                    {r.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {r.pl}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function LedgerGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill={C.gold} />
      <rect x="2" y="7.4" width="8" height="2.2" rx="1.1" fill={C.gold} opacity="0.7" />
      <rect x="2" y="11.3" width="10.5" height="2.2" rx="1.1" fill={C.gold} opacity="0.45" />
    </svg>
  );
}
