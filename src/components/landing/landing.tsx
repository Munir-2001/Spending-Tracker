"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { LedgerMark } from "@/components/logo";
import { StorySteps } from "@/components/landing/story";
import { createClient } from "@/lib/supabase/client";

// Self-contained "quiet-luxury" palette — the marketing surface commits to a
// single dark, editorial look regardless of the app's light/dark theme.
const INK = "#0E0D0B";
const CREAM = "#F6F1E7";
const GOLD = "#E9B44C";
const GREEN = "#9BB56B";
const RED = "#DE8A6A";

const rise: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const TAPE: { k: string; m: string; a: string; t: "up" | "down" | "flat" }[] = [
  { k: "Salary", m: "monthly income", a: "+ €3,200.00", t: "up" },
  { k: "Groceries", m: "Eurospin", a: "− €42.10", t: "down" },
  { k: "Gold", m: "3 tola · 24k", a: "+ ₨437,000", t: "up" },
  { k: "Rent", m: "Opera apt.", a: "− €1,050.00", t: "down" },
  { k: "Transfer", m: "Revolut → Meezan", a: "₨100,000", t: "flat" },
  { k: "Dining", m: "Sapori", a: "− €28.50", t: "down" },
  { k: "Refund", m: "from Inaam", a: "+ €13.50", t: "up" },
  { k: "Subscription", m: "Claude AI", a: "− ₨3,025", t: "down" },
];

export function Landing() {
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setLoading(false); // else the browser is already navigating away
  }

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      style={{ backgroundColor: INK, color: CREAM }}
    >
      {/* gold aura + grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.5]"
        style={{
          background: `radial-gradient(60% 42% at 50% 8%, ${GOLD}22 0%, transparent 62%)`,
        }}
      />
      <Grain />

      <div className="relative z-10">
        {/* Nav */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 md:px-10"
        >
          <span className="flex items-center gap-2.5">
            <span
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: CREAM, color: INK }}
            >
              <LedgerMark className="size-4" />
            </span>
            <span className="display text-lg tracking-tight">Ledger</span>
          </span>
          <button
            onClick={signIn}
            disabled={loading}
            className="group flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            Sign in
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.header>

        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-14 md:px-10 md:pt-28 md:pb-20">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.p
              variants={rise}
              className="num text-[11px] uppercase tracking-[0.34em]"
              style={{ color: `${CREAM}88` }}
            >
              Accounting-grade · beautifully simple
            </motion.p>

            <motion.h1
              variants={rise}
              className="display mt-6 max-w-3xl text-[clamp(2.8rem,9vw,6.5rem)] leading-[0.92] tracking-tight"
            >
              Money,
              <br />
              kept{" "}
              <span className="relative italic" style={{ color: GOLD }}>
                honest
                <motion.span
                  aria-hidden
                  className="absolute -bottom-1 left-0 block h-[3px] w-full origin-left rounded-full"
                  style={{ backgroundColor: GOLD }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
              .
            </motion.h1>

            <motion.p
              variants={rise}
              className="display mt-9 max-w-xl text-xl italic leading-snug md:text-2xl"
            >
              Discipline is what freedom actually looks like.
            </motion.p>
            <motion.p
              variants={rise}
              className="mt-3 max-w-xl text-base leading-relaxed"
              style={{ color: `${CREAM}a8` }}
            >
              Ledger gives your money the rigor of real accounting — encrypted,
              multi-currency, every figure balanced — so you always know where you
              stand, and exactly what you&apos;re free to do next.
            </motion.p>

            <motion.div variants={rise} className="mt-10 flex flex-wrap items-center gap-3">
              <button
                onClick={signIn}
                disabled={loading}
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                style={{ backgroundColor: GOLD, color: INK }}
              >
                {loading ? "Connecting…" : "Start free"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-white/5"
                style={{ borderColor: `${CREAM}26`, color: CREAM }}
              >
                How it works
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* Ledger tape — the kinetic signature */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="relative flex flex-col gap-px border-y"
          style={{ borderColor: `${CREAM}16` }}
        >
          <Tape reduce={!!reduce} direction={-1} />
          <div style={{ height: 1, backgroundColor: `${CREAM}12` }} />
          <Tape reduce={!!reduce} direction={1} slow />
        </motion.div>

        {/* Story — visual, animated walkthrough */}
        <StorySteps />

        {/* Closing */}
        <section className="mx-auto max-w-5xl px-6 pb-28 text-center md:px-10 md:pb-40">
          <motion.h2
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="display mx-auto max-w-2xl text-[clamp(2.2rem,6vw,4rem)] leading-[0.98] tracking-tight"
          >
            Begin your{" "}
            <span className="italic" style={{ color: GOLD }}>
              ledger
            </span>
            .
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-10"
          >
            <button
              onClick={signIn}
              disabled={loading}
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              style={{ backgroundColor: CREAM, color: INK }}
            >
              {loading ? "Connecting…" : "Continue with Google"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>
        </section>

        {/* Footer */}
        <footer
          className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 border-t px-6 py-8 text-xs sm:flex-row md:px-10"
          style={{ borderColor: `${CREAM}18`, color: `${CREAM}70` }}
        >
          <span className="flex items-center gap-2">
            <LedgerMark className="size-3.5" />
            Ledger — © 2026
          </span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:opacity-100">
              Privacy
            </Link>
            <button onClick={signIn} disabled={loading} className="hover:opacity-70 disabled:opacity-50">
              Sign in
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Tape({
  reduce,
  direction,
  slow,
}: {
  reduce: boolean;
  direction: 1 | -1;
  slow?: boolean;
}) {
  const items = [...TAPE, ...TAPE];
  const color = (t: "up" | "down" | "flat") =>
    t === "up" ? GREEN : t === "down" ? RED : `${CREAM}88`;
  return (
    <div className="flex overflow-hidden py-4">
      <motion.div
        className="flex shrink-0 items-center gap-10 pr-10"
        animate={reduce ? undefined : { x: direction === -1 ? ["0%", "-50%"] : ["-50%", "0%"] }}
        transition={{ duration: slow ? 60 : 44, ease: "linear", repeat: Infinity }}
      >
        {items.map((e, i) => (
          <span key={i} className="flex shrink-0 items-center gap-3 whitespace-nowrap text-sm">
            <span className="num text-[11px] uppercase tracking-widest" style={{ color: `${CREAM}55` }}>
              {e.k}
            </span>
            <span style={{ color: `${CREAM}c0` }}>{e.m}</span>
            <span className="num tabular-nums" style={{ color: color(e.t) }}>
              {e.a}
            </span>
            <span aria-hidden style={{ color: `${CREAM}30` }}>
              ·
            </span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/** Ultra-subtle film grain via an inline SVG turbulence texture. */
function Grain() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-screen"
      style={{ backgroundImage: `url("data:image/svg+xml,${svg}")` }}
    />
  );
}
