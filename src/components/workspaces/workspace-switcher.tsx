"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LedgerMark } from "@/components/logo";
import { WorkspaceDialog } from "@/components/workspaces/workspace-dialog";
import { useWorkspaces } from "@/components/workspaces/workspace-provider";
import { createWorkspace, switchWorkspace } from "@/server/actions";
import { loader } from "@/lib/loader";

/**
 * The active-workspace switcher, shown at the top of the sidebar. Switching
 * writes the active workspace server-side then `router.refresh()`es — the layout
 * re-keys the data providers so the whole app flips to the new book. Rename /
 * delete live in Settings → Workspaces.
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspaces, activeId } = useWorkspaces();
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // router.refresh() has no completion callback — end the progress bar when the
  // active workspace actually changes. done() is a no-op when nothing started.
  useEffect(() => {
    loader.done();
  }, [activeId]);

  async function handleSwitch(id: string) {
    if (id === activeId) return;
    loader.start();
    try {
      await switchWorkspace(id);
      router.replace("/dashboard"); // leave any stale /invoices/[id] route
      router.refresh();
    } catch {
      loader.done();
      toast.error("Couldn't switch workspace.");
    }
  }

  async function handleCreate(name: string) {
    setBusy(true);
    try {
      const ws = await createWorkspace(name);
      setCreateOpen(false);
      if (ws) {
        loader.start();
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Couldn't create workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
            aria-label="Switch workspace"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LedgerMark className="size-4" />
            </span>
            <span className="display flex-1 truncate text-left text-lg leading-none tracking-tight group-data-[collapsible=icon]:hidden">
              {active?.name ?? "Ledger"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              className="gap-2"
              onSelect={() => handleSwitch(w.id)}
            >
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === activeId && <Check className="size-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" /> New workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => router.push("/settings")}
            className="gap-2"
          >
            <Settings2 className="size-4" /> Manage workspaces
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editingName={null}
        busy={busy}
        onSubmit={handleCreate}
      />
    </>
  );
}
