"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/server/actions";
import { cn } from "@/lib/utils";

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = message.trim();
    if (!msg) return toast.error("Please write a little feedback first.");
    setSubmitting(true);
    try {
      await submitFeedback({ message: msg, rating: rating || null, page: pathname });
      toast.success("Thanks for the feedback!", { description: "We read every note." });
      setMessage("");
      setRating(0);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">Send feedback</DialogTitle>
          <DialogDescription>
            Found a bug, or have an idea? Tell us — it goes straight to the team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">How&apos;s your experience?</p>
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
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fb-msg" className="text-sm font-medium">
              Your feedback
            </label>
            <textarea
              id="fb-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              autoFocus
              placeholder="What's working, what's not, what you'd love to see…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
