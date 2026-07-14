"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Menu, Search, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth-actions";
import { ProjectNavList } from "@/components/layout/ProjectNavList";
import { NavigationSections } from "@/components/layout/NavigationSections";
import type { SidebarProject } from "@/actions/sidebar-actions";

export function Header({ userRole, userName, projects }: { userRole: string; userName: string; projects: SidebarProject[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const dashboardTitles: Record<string, string> = { projects: "项目看板", budget: "预算管理", calendar: "执行日历" };
  const title = pathname === "/dashboard" ? dashboardTitles[searchParams.get("view") ?? ""] ?? "全局大盘" : currentNav?.label ?? (pathname.startsWith("/projects/") ? "项目" : "ShadowPM");

  return (
    <>
      <header className="sticky top-0 z-30 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/80 bg-canvas/85 px-4 backdrop-blur-xl md:grid-cols-[minmax(180px,1fr)_minmax(320px,560px)_minmax(180px,1fr)] md:px-7">
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
          <div className="min-w-0">
            <p className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:block">项目控制空间</p>
            <h2 className="truncate text-base font-semibold text-foreground md:text-lg">{title}</h2>
          </div>
        </div>
        <button type="button" onClick={() => window.dispatchEvent(new Event("shadowpm:open-command"))} className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-surface-1/85 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/35 hover:bg-surface-2 md:flex">
          <Search className="size-4 text-primary" />
          <span className="flex-1">搜索项目、事项，或输入命令...</span>
          <kbd className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘ K</kbd>
        </button>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => window.dispatchEvent(new Event("shadowpm:open-command"))} className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground md:hidden">⌘ K</button>
          <span className="truncate text-xs text-muted-foreground md:hidden">{userName}</span>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭导航"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col bg-sidebar text-foreground shadow-[20px_0_60px_rgba(0,5,18,0.55)]">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-sky-300 to-cyan-300 text-xs font-bold text-primary-foreground">S</span>
                <span className="font-semibold">ShadowPM</span>
              </div>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setMenuOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavigationSections userRole={userRole} onNavigate={() => setMenuOpen(false)} />
            </nav>
            <div className="min-h-0 overflow-y-auto border-t border-border p-3">
              <ProjectNavList projects={projects} onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="border-t border-border p-3">
              <div className="flex items-center justify-between rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userRole === "LEADER" ? "管理者" : "执行成员"}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => logout()} title="退出登录">
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
