"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteAllData, deleteUserAccount } from "@/server/actions";
import { loader } from "@/lib/loader";

/**
 * Settings → Danger zone: a clear exit for the user. "Delete all my data" wipes
 * everything but keeps the login (fresh start); "Delete my account" removes the
 * account entirely (type-to-confirm), then drops them back to the landing page.
 */
export function DangerZone() {
  const router = useRouter();
  const confirm = useConfirm();
  const [wiping, setWiping] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmed = confirmText.trim().toUpperCase() === "DELETE";

  async function wipe() {
    const ok = await confirm({
      title: "Delete all your data?",
      description:
        "This permanently erases every account, transaction, asset, invoice, and workspace. Your login stays and you start fresh with an empty Personal workspace. This can’t be undone.",
      confirmText: "Delete everything",
      tone: "danger",
    });
    if (!ok) return;
    setWiping(true);
    loader.start();
    try {
      await deleteAllData();
      toast.success("All data deleted — fresh start.");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast.error("Couldn’t delete your data. Please try again.");
    } finally {
      setWiping(false);
      loader.done();
    }
  }

  async function removeAccount() {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteUserAccount();
      // The session is now invalid — send them to the landing page.
      window.location.href = "/?deleted=1";
    } catch {
      toast.error("Couldn’t delete your account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-destructive">
            Danger zone
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Irreversible actions. Please be certain.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Delete all my data</p>
            <p className="text-xs text-muted-foreground">
              Erase everything, keep your login, start fresh.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={wipe}
            disabled={wiping}
          >
            {wiping ? "Deleting…" : "Delete data"}
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Delete my account</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove your account and all data.
            </p>
          </div>
          <Button
            variant="destructive"
            className="shrink-0"
            onClick={() => {
              setConfirmText("");
              setDelOpen(true);
            }}
          >
            Delete account
          </Button>
        </div>
      </div>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and everything in it. This
              cannot be undone. Type{" "}
              <span className="font-semibold text-foreground">DELETE</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm">Confirmation</Label>
            <Input
              id="del-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmed) removeAccount();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDelOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeAccount}
              disabled={deleting || !confirmed}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
