import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/landing";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} \u2014 Money, kept honest.`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

// Structured data so search + AI surfaces understand what the app is.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function HomePage() {
  // In local mode there's no auth or marketing funnel — go straight to the app.
  // In hosted mode, signed-in users are bounced to /dashboard by middleware;
  // everyone else sees the landing.
  if (!SUPABASE_CONFIGURED) redirect("/dashboard");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Landing />
    </>
  );
}
