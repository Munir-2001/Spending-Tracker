import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/landing";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Ledger — Money, kept honest.",
  description:
    "An accounting-grade personal finance tracker. Double-entry rigor underneath, encrypted and multi-currency, beautifully simple on top.",
};

export default function HomePage() {
  // In local mode there's no auth or marketing funnel — go straight to the app.
  // In hosted mode, signed-in users are bounced to /dashboard by middleware;
  // everyone else sees the landing.
  if (!SUPABASE_CONFIGURED) redirect("/dashboard");
  return <Landing />;
}
