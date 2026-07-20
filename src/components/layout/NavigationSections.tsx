"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FolderKanban, LayoutDashboard, LifeBuoy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeWhen?: (pathname: string, view: string | null) => boolean;
};

const PRIMARY_ITEMS: NavigationItem[] = [
  { label: "工作台", href: "/workspace", icon: <FolderKanban className="size-4" /> },
  {
    label: "项目",
    href: "/projects",
    icon: <FolderKanban className="size-4" />,
    activeWhen: (pathname) => pathname === "/projects",
  },
];

const UTILITY_ITEMS: NavigationItem[] = [
  { label: "团队与权限", href: "/team", icon: <ShieldCheck className="size-4" /> },
  { label: "帮助与反馈", href: "/guide", icon: <LifeBuoy className="size-4" /> },
];

export function NavigationSections({ userRole, onNavigate, variant = "all" }: { userRole: string; onNavigate?: () => void; variant?: "primary" | "utility" | "all" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const primaryItems = userRole === "LEADER"
    ? [...PRIMARY_ITEMS, { label: "管理总览", href: "/dashboard", icon: <LayoutDashboard className="size-4" /> }]
    : PRIMARY_ITEMS;
  const utilityItems = userRole === "LEADER" ? UTILITY_ITEMS : UTILITY_ITEMS.filter((item) => item.href === "/guide");

  return (
    <div className={variant === "all" ? "space-y-4" : undefined}>
      {variant !== "utility" && <NavigationList items={primaryItems} pathname={pathname} view={view} onNavigate={onNavigate} />}
      {variant !== "primary" && <NavigationList items={utilityItems} pathname={pathname} view={view} onNavigate={onNavigate} subdued={variant === "all"} />}
    </div>
  );
}

function NavigationList({ items, pathname, view, onNavigate, subdued = false }: { items: NavigationItem[]; pathname: string; view: string | null; onNavigate?: () => void; subdued?: boolean }) {
  return (
    <div className={cn("space-y-1", subdued && "border-t border-border pt-3")}>
      {items.map((item) => {
        const active = item.activeWhen ? item.activeWhen(pathname, view) : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150",
              active
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted-foreground hover:bg-surface-2/75 hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
