import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Branded social-share card (og:image + twitter:image). Next wires the meta tags
// automatically from this file convention; regenerated per deploy.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0E0D0B";
const CREAM = "#F6F1E7";
const GOLD = "#E9B44C";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 80px",
          background: INK,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        {/* subtle gold wash at the top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 300,
            background: `linear-gradient(180deg, ${GOLD}1f 0%, ${INK}00 100%)`,
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: CREAM,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 7,
              padding: "0 15px",
            }}
          >
            <div style={{ height: 9, width: 34, borderRadius: 5, background: INK }} />
            <div style={{ height: 9, width: 22, borderRadius: 5, background: INK, opacity: 0.7 }} />
            <div style={{ height: 9, width: 28, borderRadius: 5, background: INK, opacity: 0.45 }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
            Money, kept{" "}
            <span style={{ color: GOLD, fontStyle: "italic", marginLeft: 20 }}>honest.</span>
          </div>
          <div style={{ fontSize: 30, color: `${CREAM}b0`, maxWidth: 920, lineHeight: 1.35 }}>
            Accounting-grade personal finance — accounts, budgets, and net worth
            with live gold, crypto &amp; FX. Encrypted and multi-currency.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, color: `${CREAM}80` }}>spending-tracker-wallet.vercel.app</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${GOLD}66`,
              color: GOLD,
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            Beta · 100 users only
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
