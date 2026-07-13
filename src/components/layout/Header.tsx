"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FolderKanban, LayoutDashboard, LogOut, Menu, MessageSquareText, Users, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth-actions";

const ICON_MAP: Record<string, React.ReactNode> = {
  "工作台": <FolderKanban className="size-4" />,
  "全局大盘": <LayoutDashboard className="size-4" />,
  "外测反馈": <MessageSquareText className="size-4" />,
  "团队权限": <Users className="size-4" />,
};

export function Header({ userRole, userName }: { userRole: string; userName: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const title = currentNav?.label ?? (pathname.startsWith("/projects/") ? "项目" : "ShadowPM");
  const items = NAV_ITEMS.filter((item) => (item.roles as readonly string[]).includes(userRole));

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="打开导航"
          >
            <Menu className="size-4" />
          </Button>
          <h2 className="truncate text-base font-semibold text-foreground md:text-lg">{title}</h2>
        </div>
        <span className="truncate text-xs text-muted-foreground md:hidden">{userName}</span>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭导航"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col bg-[#0b0d0c] text-white shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-white text-xs font-bold text-black">S</span>
                <span className="font-semibold">ShadowPM</span>
              </div>
              <Button variant="ghost" size="icon" className="size-8 text-gray-300 hover:bg-white/10 hover:text-white" onClick={() => setMenuOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active ? "bg-white/10 font-medium text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {ICON_MAP[item.label]}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center justify-between rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-gray-500">{userRole === "LEADER" ? "管理者" : "执行成员"}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:bg-white/10 hover:text-white" onClick={() => logout()} title="退出登录">
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
