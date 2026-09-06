"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Wallet,
    title: "Your whole financial life, kept honest.",
    body: "Every account, card, currency, and asset — gold, crypto, property — in one calm, beautiful place. Net worth, budgets, and Zakat, always up to date.",
  },
  {
    icon: FileText,
    title: "Invoice clients. Get paid.",
    body: "Build gorgeous invoices with a live preview, export a polished PDF, and share a pay-link — then a paid invoice flows straight into your income.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design.",
    body: "Sensitive fields are encrypted before they ever hit the database, and one tap blurs every figure on screen. Your money is yours.",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
      <div className="flex flex-1 flex-col justify-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="size-6" />
        </span>
        <h1 className="display mt-8 text-3xl leading-tight tracking-tight">
          {step.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{step.body}</p>
      </div>

      {/* Progress dots */}
      <div className="mb-6 flex justify-center gap-2">
        {STEPS.map((_, idx) => (
          <span
            key={idx}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === i ? "w-6 bg-foreground" : "w-1.5 bg-border"
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        {last ? (
          <span />
        ) : (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        )}
        <Button
          size="lg"
          className="min-w-32"
          onClick={() => (last ? router.push("/dashboard") : setI(i + 1))}
        >
          {last ? "Get started" : "Next"}
        </Button>
      </div>
    </main>
  );
}
