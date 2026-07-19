import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// Private, auth-gated app sections — never index these.
const PRIVATE = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/assets",
  "/budgets",
  "/goals",
  "/categories",
  "/recurring",
  "/reimbursements",
  "/subscriptions",
  "/insights",
  "/reports",
  "/wrapped",
  "/ledger",
  "/settings",
  "/support",
  "/faq",
  "/auth",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
