"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/components/transactions/transactions-provider";

export function NewTransactionButton() {
  const { openAdd } = useTransactions();
  return (
    <Button size="sm" className="gap-1.5 shadow-sm" onClick={openAdd}>
      <Plus className="size-4" />
      <span className="hidden sm:inline">New transaction</span>
    </Button>
  );
}
