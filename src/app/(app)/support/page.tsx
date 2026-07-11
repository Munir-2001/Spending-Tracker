"use client";

import Link from "next/link";
import {
  LifeBuoy,
  HelpCircle,
  ShieldCheck,
  Mail,
  Bug,
  ArrowUpRight,
} from "lucide-react";

import { Reveal } from "@/components/reveal";
import { SUPPORT_EMAIL } from "@/lib/site";

const links = [
  {
    title: "FAQ",
    description: "Quick answers on security, balances, transfers, and more.",
    href: "/faq",
    icon: HelpCircle,
    external: false,
  },
  {
    title: "Privacy Policy",
    description: "What we store, how it's encrypted, and your rights.",
    href: "/privacy",
    icon: ShieldCheck,
    external: false,
  },
  {
    title: "Email support",
    description: "A question we haven't answered? We'll get back to you.",
    href: `mailto:${SUPPORT_EMAIL}`,
    icon: Mail,
    external: true,
  },
  {
    title: "Report a bug",
    description: "Something broken or off? Tell us what you saw.",
    href: `mailto:${SUPPORT_EMAIL}?subject=Ledger%20bug%20report`,
    icon: Bug,
    external: true,
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <span className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
            <LifeBuoy className="size-5" />
          </span>
          <h1 className="display mt-3 text-3xl tracking-tight md:text-4xl">
            Support
          </h1>
          <p className="text-sm text-muted-foreground">
            We&apos;re here to help you get the most out of Ledger.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {links.map((l) => {
            const Icon = l.icon;
            const inner = (
              <div className="group flex h-full items-start gap-3 rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {l.title}
                    <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {l.description}
                  </p>
                </div>
              </div>
            );
            return l.external ? (
              <a key={l.title} href={l.href}>
                {inner}
              </a>
            ) : (
              <Link key={l.title} href={l.href}>
                {inner}
              </Link>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface p-5 text-sm text-muted-foreground">
          Reach us directly at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          . We typically reply within a couple of days.
        </div>
      </Reveal>
    </div>
  );
}