/**
 * A horizontal, infinitely-scrolling "ledger tape" marquee for the dark
 * marketing surfaces. The animation runs on the compositor (a CSS keyframe,
 * see `ledger-marquee-l/r` in globals.css) so it stays off the main thread.
 *
 * Self-contained palette so it reads on-brand regardless of the app theme.
 * Pass `items` to show your own entries; the default is generic sample data
 * (never real financial data).
 */
const CREAM = "#F6F1E7";
const GREEN = "#9BB56B";
const RED = "#DE8A6A";

export type TapeItem = {
  /** Short uppercase kicker, e.g. "Salary". */
  k: string;
  /** Muted middle label, e.g. "monthly income". */
  m: string;
  /** The figure, e.g. "+ €4,200.00". */
  a: string;
  /** Tints the figure: up = green, down = red, flat = muted. */
  t: "up" | "down" | "flat";
};

/** Generic sample entries — deliberately not real data. */
export const SAMPLE_TAPE: TapeItem[] = [
  { k: "Salary", m: "Monthly income", a: "+ €4,200.00", t: "up" },
  { k: "Groceries", m: "Eurospin", a: "− €38.90", t: "down" },
  { k: "Gold", m: "1 Kg · 24k", a: "+ $1,940", t: "up" },
  { k: "Rent", m: "Apartment", a: "− €1,150.00", t: "down" },
  { k: "Transfer", m: "Savings → Checking", a: "£500", t: "flat" },
  { k: "Dining", m: "restaurant", a: "− €31.00", t: "down" },
  { k: "Refund", m: "returned order", a: "+ €19.99", t: "up" },
  { k: "Subscription", m: "streaming", a: "− €14.99", t: "down" },
];

export function Tape({
  reduce,
  direction,
  slow,
  items = SAMPLE_TAPE,
}: {
  /** Honor prefers-reduced-motion — freezes the marquee when true. */
  reduce: boolean;
  /** 1 scrolls right, -1 scrolls left. */
  direction: 1 | -1;
  /** Slower cadence (60s vs 44s) for a secondary, offset row. */
  slow?: boolean;
  items?: TapeItem[];
}) {
  // Duplicate the set so the -50% keyframe loops seamlessly.
  const doubled = [...items, ...items];
  const color = (t: TapeItem["t"]) =>
    t === "up" ? GREEN : t === "down" ? RED : `${CREAM}88`;
  const animation = reduce
    ? undefined
    : `ledger-marquee-${direction === -1 ? "l" : "r"} ${slow ? 60 : 44}s linear infinite`;

  return (
    <div className="flex overflow-hidden py-4">
      <div
        className="flex shrink-0 items-center gap-10 pr-10"
        style={{ animation, willChange: "transform" }}
      >
        {doubled.map((e, i) => (
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
      </div>
    </div>
  );
}
