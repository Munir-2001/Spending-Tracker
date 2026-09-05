"use client";

import { Plus, Users, Mail, Phone } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu } from "@/components/ui/row-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useInvoices } from "@/components/invoices/invoices-provider";
import type { Client } from "@/lib/data";

export default function ClientsPage() {
  const { clients, openAddClient } = useInvoices();
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl tracking-tight md:text-4xl">
              Clients
            </h1>
            <p className="text-sm text-muted-foreground">
              The people and companies you bill. Details flow onto their
              invoices.
            </p>
          </div>
          <Button onClick={openAddClient} className="shrink-0 gap-1.5">
            <Plus className="size-4" />
            New
          </Button>
        </div>
      </Reveal>

      {sorted.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            className="mt-10"
            icon={<Users className="size-6" />}
            title="No clients yet"
            description="Add a client and you can start sending them invoices."
            action={
              <Button
                onClick={openAddClient}
                variant="outline"
                className="gap-1.5"
              >
                <Plus className="size-4" />
                New client
              </Button>
            }
          />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <ul className="mt-8 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {sorted.map((c) => (
              <ClientRow key={c.id} client={c} />
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

function ClientRow({ client }: { client: Client }) {
  const { openEditClient, removeClient } = useInvoices();
  const confirm = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${client.name}?`,
      description: "This won't remove invoices already created for them.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) removeClient(client.id);
  }

  const initials = client.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[13px] font-medium text-foreground">
        {initials || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {client.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {client.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {client.email}
            </span>
          )}
          {client.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" />
              {client.phone}
            </span>
          )}
          <span>{client.currency}</span>
        </p>
      </div>
      <RowMenu
        onEdit={() => openEditClient(client)}
        onDelete={onDelete}
        label={`Actions for ${client.name}`}
      />
    </li>
  );
}
