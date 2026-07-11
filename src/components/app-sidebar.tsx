"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Tag,
  Repeat,
  PiggyBank,
  CalendarClock,
  Sparkles,
  Settings,
  LifeBuoy,
  HelpCircle,
  ShieldCheck,
  LogOut,
} from "lucide-react";

import { signOut } from "@/server/actions";

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

const primaryNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Accounts", href: "/accounts", icon: Wallet },
  { title: "Assets", href: "/assets", icon: Boxes },
  { title: "Categories", href: "/categories", icon: Tag },
  { title: "Budgets", href: "/budgets", icon: Target },
  { title: "Goals", href: "/goals", icon: PiggyBank },
  { title: "Recurring", href: "/recurring", icon: CalendarClock },
  { title: "Subscriptions", href: "/subscriptions", icon: Repeat },
  { title: "Reimbursements", href: "/reimbursements", icon: HandCoins },
  { title: "Insights", href: "/insights", icon: ChartPie },
  { title: "Reports", href: "/reports", icon: PieChart },
  { title: "Wrapped", href: "/wrapped", icon: Sparkles },
  { title: "Ledger", href: "/ledger", icon: BookOpen },
];

const secondaryNav = [
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
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mark />
          </span>
          <span className="display text-lg leading-none tracking-tight group-data-[collapsible=icon]:hidden">
            Ledger
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNav.map((item) => (
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

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map((item) => (
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

/** Minimal geometric ledger mark — two stacked balanced bars. */
function Mark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="3.5" width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect
        x="2"
        y="7.4"
        width="8"
        height="2.2"
        rx="1.1"
        fill="currentColor"
        opacity="0.7"
      />
      <rect
        x="2"
        y="11.3"
        width="10.5"
        height="2.2"
        rx="1.1"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  );
}
