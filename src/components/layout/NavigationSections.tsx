"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, FolderKanban, LayoutDashboard, MessageSquareText, ShieldCheck, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  view?: string;
};

const DASHBOARD_ITEMS: NavigationItem[] = [
  { label: "概览", href: "/dashboard", icon: <LayoutDashboard className="size-4" />, view: "overview" },
  { label: "项目看板", href: "/dashboard?view=projects", icon: <FolderKanban className="size-4" />, view: "projects" },
  { label: "预算管理", href: "/dashboard?view=budget", icon: <WalletCards className="size-4" />, view: "budget" },
  { label: "执行日历", href: "/dashboard?view=calendar", icon: <CalendarDays className="size-4" />, view: "calendar" },
];

const WORKSPACE_ITEMS: NavigationItem[] = [
  { label: "工作台", href: "/workspace", icon: <FolderKanban className="size-4" /> },
];

const MANAGEMENT_ITEMS: NavigationItem[] = [
  { label: "使用反馈", href: "/feedback", icon: <MessageSquareText className="size-4" /> },
  { label: "团队权限", href: "/team", icon: <ShieldCheck className="size-4" /> },
];

export function NavigationSections({ userRole, onNavigate }: { userRole: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dashboardView = searchParams.get("view") ?? "overview";

  return (
    <div className="space-y-5">
      {userRole === "LEADER" && <NavigationSection label="全局大盘" items={DASHBOARD_ITEMS} pathname={pathname} dashboardView={dashboardView} onNavigate={onNavigate} />}
      <NavigationSection label="工作空间" items={userRole === "LEADER" ? [...WORKSPACE_ITEMS, ...MANAGEMENT_ITEMS] : WORKSPACE_ITEMS} pathname={pathname} dashboardView={dashboardView} onNavigate={onNavigate} />
    </div>
  );
}

function NavigationSection({ label, items, pathname, dashboardView, onNavigate }: { label: string; items: NavigationItem[]; pathname: string; dashboardView: string; onNavigate?: () => void }) {
  return (
    <section>
      <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{label}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const isDashboardItem = item.href.startsWith("/dashboard");
          const active = isDashboardItem ? pathname === "/dashboard" && dashboardView === item.view : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all duration-150",
                active
                  ? "border-primary/30 bg-primary/10 font-medium text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-2/75 hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
