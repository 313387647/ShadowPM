"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderKanban, LayoutGrid, LifeBuoy, LogOut, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { logout } from "@/actions/auth-actions";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = [
    { label: "工作台", href: "/workspace", icon: LayoutGrid },
    { label: "项目", href: "/projects", icon: FolderKanban },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-border bg-popover/95 px-2 pt-2 backdrop-blur md:hidden">
        {items.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 px-2 text-[11px]", pathname === href || pathname.startsWith(`${href}/`) ? "text-primary" : "text-muted-foreground")}>
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => window.dispatchEvent(new Event("shadowpm:open-command"))} className="flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 px-2 text-[11px] text-muted-foreground" aria-label="打开搜索">
          <Search className="size-4" />
          <span>搜索</span>
        </button>
        <button type="button" onClick={() => setMoreOpen(true)} className={cn("flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 px-2 text-[11px]", moreOpen ? "text-primary" : "text-muted-foreground")} aria-label="打开更多功能">
          <MoreHorizontal className="size-4" />
          <span>更多</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent size="auto" className="md:hidden">
          <SheetHeader title="更多" />
          <div className="mt-4 space-y-1">
            {userRole === "LEADER" && (
              <MobileLink href="/dashboard" icon={BarChart3} onNavigate={() => setMoreOpen(false)}>管理总览</MobileLink>
            )}
            {userRole === "LEADER" && (
              <MobileLink href="/team" icon={ShieldCheck} onNavigate={() => setMoreOpen(false)}>团队与权限</MobileLink>
            )}
            <MobileLink href="/guide" icon={LifeBuoy} onNavigate={() => setMoreOpen(false)}>帮助与反馈</MobileLink>
            <ThemeToggle variant="row" />
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <button type="button" onClick={() => logout()} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
              <LogOut className="size-4" />
              退出登录
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MobileLink({ href, icon: Icon, onNavigate, children }: { href: string; icon: typeof LayoutGrid; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-foreground transition-colors hover:bg-surface-2">
      <Icon className="size-4 text-muted-foreground" />
      {children}
    </Link>
  );
}
