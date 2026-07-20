"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth-actions";
import { ProjectNavList } from "@/components/layout/ProjectNavList";
import { NavigationSections } from "@/components/layout/NavigationSections";
import { BrandMark } from "@/components/layout/BrandMark";
import type { SidebarProject } from "@/actions/sidebar-actions";

interface SidebarProps {
  userRole: string;
  userName: string;
  projects: SidebarProject[];
}

export function Sidebar({ userRole, userName, projects }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-border bg-sidebar text-foreground md:flex">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight">ShadowPM</span>
      </div>

      <nav className="shrink-0 px-2.5 py-3">
        <NavigationSections userRole={userRole} variant="primary" />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-2.5 py-3">
        <ProjectNavList projects={projects} />
      </div>

      <div className="border-t border-border p-2.5">
        <NavigationSections userRole={userRole} variant="utility" />
        <div className="flex items-center justify-between rounded-md px-2.5 py-2 transition-colors hover:bg-surface-2/70">
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
