"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, FolderKanban, Users, LogOut, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth-actions";

const ICON_MAP: Record<string, React.ReactNode> = {
  "AI 工作台": <FolderKanban className="size-4" />,
  "全局大盘": <LayoutDashboard className="size-4" />,
  "外测反馈": <MessageSquareText className="size-4" />,
  "团队负载": <Users className="size-4" />,
};

interface SidebarProps {
  userRole: string;
  userName: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r bg-gray-950 text-gray-50">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-800 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-gray-50 text-xs font-bold text-gray-950">
          S
        </div>
        <span className="font-semibold">ShadowPM</span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-gray-800 text-white font-medium"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
              )}
            >
              {ICON_MAP[item.label]}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 底部用户区 */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-gray-500">
              {userRole === "LEADER" ? "管理者" : "执行成员"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => logout()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
