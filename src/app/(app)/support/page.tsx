"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  LifeBuoy,
  HelpCircle,
  ShieldCheck,
  ArrowUpRight,
  Star,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  listFeedback,
  submitFeedback,
  updateFeedback,
  deleteFeedback,
} from "@/server/actions";
import type { Feedback } from "@/lib/data";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const links = [
  {
    title: "FAQ",
    description: "Quick answers on security, balances, transfers, and more.",
    href: "/faq",
    icon: HelpCircle,
  },
  {
    title: "Privacy Policy",
    description: "What we store, how it's encrypted, and your rights.",
    href: "/privacy",
    icon: ShieldCheck,
  },
];

export default function SupportPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listFeedback()
      .then(setItems)
      .catch(() => toast.error("Couldn't load your feedback."))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setMessage("");
    setRating(0);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = message.trim();
    if (!msg) return toast.error("Please write your feedback first.");
    setBusy(true);
    try {
      if (editingId) {
        const saved = await updateFeedback(editingId, { message: msg, rating: rating || null });
        if (saved) setItems((prev) => prev.map((f) => (f.id === editingId ? saved : f)));
        toast.success("Feedback updated");
      } else {
        const saved = await submitFeedback({ message: msg, rating: rating || null, page: "/support" });
        setItems((prev) => [saved, ...prev]);
        toast.success("Thanks for the feedback!");
      }
      resetForm();
    } catch {
      toast.error("Couldn't save your feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(f: Feedback) {
    setEditingId(f.id);
    setMessage(f.message);
    setRating(f.rating ?? 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(f: Feedback) {
    const ok = await confirm({
      title: "Delete this feedback?",
      description: "It will be permanently removed.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteFeedback(f.id);
      setItems((prev) => prev.filter((x) => x.id !== f.id));
      if (editingId === f.id) resetForm();
      toast.success("Feedback removed");
    } catch {
      toast.error("Couldn't delete. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-1.5">
          <span className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground">
            <LifeBuoy className="size-5" />
          </span>
          <h1 className="display mt-3 text-3xl tracking-tight md:text-4xl">Support</h1>
          <p className="text-sm text-muted-foreground">
            Send us feedback or a bug report — and see everything you&apos;ve sent.
          </p>
        </div>
      </Reveal>

      {/* Feedback form */}
      <Reveal delay={0.05}>
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-border/60 bg-card p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              {editingId ? "Edit feedback" : "Send feedback"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Cancel edit
              </button>
            )}
          </div>

          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n === rating ? 0 : n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-0.5 text-muted-foreground transition-colors hover:text-warning"
              >
                <Star className={cn("size-6", n <= rating && "fill-warning text-warning")} />
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What's working, what's broken, what you'd love to see…"
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save changes" : "Send feedback"}
            </Button>
          </div>
        </form>
      </Reveal>

      {/* Your feedback */}
      <Reveal delay={0.1}>
        <div className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">Your feedback</h2>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Nothing yet — your submitted feedback will show here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    {f.rating ? (
                      <div className="mb-1 flex gap-0.5">
                        {Array.from({ length: f.rating }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-warning text-warning" />
                        ))}
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelativeDay(f.createdAt)}
                      {f.page ? ` · from ${f.page}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label="Edit feedback"
                      onClick={() => startEdit(f)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-expense"
                      aria-label="Delete feedback"
                      onClick={() => remove(f)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>

      {/* Helpful links */}
      <Reveal delay={0.15}>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.title} href={l.href}>
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
              </Link>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
