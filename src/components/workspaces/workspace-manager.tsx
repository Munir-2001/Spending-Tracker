"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkspaceDialog } from "@/components/workspaces/workspace-dialog";
import { useWorkspaces } from "@/components/workspaces/workspace-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
} from "@/server/actions";
import { loader } from "@/lib/loader";
import type { Workspace } from "@/lib/data";

/** Settings → Workspaces: list, rename, delete, and create workspaces. */
export function WorkspaceManager() {
  const router = useRouter();
  const { workspaces, activeId } = useWorkspaces();
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const onlyOne = workspaces.length <= 1;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openRename(w: Workspace) {
    setEditing(w);
    setDialogOpen(true);
  }

  async function submit(name: string) {
    setBusy(true);
    try {
      if (editing) {
        await renameWorkspace(editing.id, name);
        setDialogOpen(false);
        router.refresh();
      } else {
        const ws = await createWorkspace(name);
        setDialogOpen(false);
        if (ws) {
          loader.start();
          router.replace("/dashboard");
          router.refresh();
        }
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: Workspace) {
    if (onlyOne) {
      toast.error("You need at least one workspace.");
      return;
    }
    const ok = await confirm({
      title: `Delete “${w.name}”?`,
      description:
        "This permanently deletes every account, transaction, invoice, and setting in this workspace. This can’t be undone.",
      confirmText: "Delete workspace",
      tone: "danger",
    });
    if (!ok) return;
    loader.start();
    try {
      await deleteWorkspace(w.id);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      loader.done();
      toast.error(e instanceof Error ? e.message : "Couldn’t delete.");
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Workspaces</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Separate books — each with its own accounts, transactions, invoices,
            and settings.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={openCreate}
        >
          <Plus className="size-4" /> New
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-border/50">
        {workspaces.map((w) => (
          <li key={w.id} className="flex items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {w.name}
              {w.id === activeId && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · current
                </span>
              )}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground"
              onClick={() => openRename(w)}
              aria-label={`Rename ${w.name}`}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-expense"
              onClick={() => remove(w)}
              disabled={onlyOne}
              aria-label={`Delete ${w.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <WorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingName={editing?.name ?? null}
        busy={busy}
        onSubmit={submit}
      />
    </section>
  );
}
