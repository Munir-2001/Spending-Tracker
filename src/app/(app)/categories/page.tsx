"use client";

import { Plus, Pencil, Trash2, MoreHorizontal, Tag } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppData } from "@/components/transactions/transactions-provider";
import type { Category } from "@/lib/data";

export default function CategoriesPage() {
  const { categories, openAddCategory, openEditCategory, deleteCategory } =
    useAppData();

  const expense = categories.filter((c) => c.kind === "expense");
  const income = categories.filter((c) => c.kind === "income");

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="display text-3xl tracking-tight md:text-4xl">
              Categories
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Group your spending and income for budgets and reports.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAddCategory}>
            <Plus className="size-4" />
            Add category
          </Button>
        </div>
      </Reveal>

      {categories.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Tag className="size-6" />
            </span>
            <div>
              <p className="font-medium">No categories yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first category to start organizing transactions.
              </p>
            </div>
            <Button className="gap-1.5" onClick={openAddCategory}>
              <Plus className="size-4" />
              Add category
            </Button>
          </div>
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <CategoryGroup
              title="Expense"
              items={expense}
              onEdit={openEditCategory}
              onDelete={deleteCategory}
            />
          </Reveal>
          {income.length > 0 && (
            <Reveal delay={0.1}>
              <CategoryGroup
                title="Income"
                items={income}
                onEdit={openEditCategory}
                onDelete={deleteCategory}
              />
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}

function CategoryGroup({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  items: Category[];
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card">
      <p className="flex items-center justify-between border-b border-border/60 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <span>{title}</span>
        <span>{items.length}</span>
      </p>
      <ul className="divide-y divide-border/50 px-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3 pl-1 pr-1">
            <span
              className="size-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: c.tint }}
            />
            <span className="flex-1 truncate text-sm font-medium">{c.label}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Category actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(c)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </section>
  );
}
