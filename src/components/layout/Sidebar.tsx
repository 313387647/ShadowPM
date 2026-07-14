"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth-actions";
import { ProjectNavList } from "@/components/layout/ProjectNavList";
import { NavigationSections } from "@/components/layout/NavigationSections";
import type { SidebarProject } from "@/actions/sidebar-actions";

interface SidebarProps {
  userRole: string;
  userName: string;
  projects: SidebarProject[];
}

export function Sidebar({ userRole, userName, projects }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-border bg-sidebar text-foreground md:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-sky-300 to-cyan-300 text-xs font-bold text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.24)]">
          S
        </div>
        <div>
          <span className="block text-sm font-semibold tracking-tight">ShadowPM</span>
          <span className="block text-[10px] tracking-[0.16em] text-muted-foreground">CONTROL SYSTEM</span>
        </div>
      </div>

      <nav className="shrink-0 px-3 py-5">
        <NavigationSections userRole={userRole} />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-4">
        <ProjectNavList projects={projects} />
      </div>

      {/* 底部用户区 */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-surface-2/70">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">
              {userRole === "LEADER" ? "管理者" : "执行成员"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => logout()}
            title="退出登录"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
