"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Boxes,
  Target,
  PieChart,
  ChartPie,
  BookOpen,
  HandCoins,
  FileText,
  Users,
  Landmark,
  Tag,
  PiggyBank,
  CalendarClock,
  // Repeat, // re-add when re-enabling the hidden Subscriptions nav below
  HandHeart,
  Sparkles,
  Settings,
  LifeBuoy,
  HelpCircle,
  ShieldCheck,
  MessageSquarePlus,
  LogOut,
} from "lucide-react";

import { signOut } from "@/server/actions";
import { FeedbackDialog } from "@/components/feedback-dialog";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

// Grouped so 14 destinations read as a few tidy sections instead of one wall.
const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Insights", href: "/insights", icon: ChartPie },
      { title: "Reports", href: "/reports", icon: PieChart },
      { title: "Wrapped", href: "/wrapped", icon: Sparkles },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { title: "Accounts", href: "/accounts", icon: Wallet },
      { title: "Assets", href: "/assets", icon: Boxes },
      { title: "Ledger", href: "/ledger", icon: BookOpen },
    ],
  },
  {
    label: "Planning",
    items: [
      { title: "Budgets", href: "/budgets", icon: Target },
      { title: "Goals", href: "/goals", icon: PiggyBank },
      { title: "Zakat", href: "/zakat", icon: HandHeart },
      { title: "Recurring", href: "/recurring", icon: CalendarClock },
      // Hidden for now — we'll work on Subscriptions later. Re-enable this line
      // (and the Repeat import above) to bring it back:
      // { title: "Subscriptions", href: "/subscriptions", icon: Repeat },
    ],
  },
  {
    label: "Invoicing",
    items: [
      { title: "Invoices", href: "/invoices", icon: FileText },
      { title: "Clients", href: "/clients", icon: Users },
      { title: "Payment methods", href: "/payment-methods", icon: Landmark },
    ],
  },
  {
    label: "Organize",
    items: [
      { title: "Categories", href: "/categories", icon: Tag },
      { title: "Reimbursements", href: "/reimbursements", icon: HandCoins },
    ],
  },
];

const workspaceNav = [
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Support", href: "/support", icon: LifeBuoy },
  { title: "FAQ", href: "/faq", icon: HelpCircle },
  { title: "Privacy", href: "/privacy", icon: ShieldCheck },
];

export function AppSidebar({
  user,
}: {
  user: { name: string; email: string } | null;
}) {
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const initials = (user?.name ?? "You")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setFeedbackOpen(true)}
                  tooltip="Send feedback"
                >
                  <MessageSquarePlus className="size-4" />
                  <span>Feedback</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {workspaceNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      <SidebarFooter className="p-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/60 p-2 group-data-[collapsible=icon]:hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-income/12 text-[13px] font-medium text-income">
            {initials || "Y"}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user?.name ?? "You"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email ?? "Signed in"}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

