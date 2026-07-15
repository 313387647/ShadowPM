"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderKanban, LayoutGrid, MoreHorizontal, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = [
    { label: "工作台", href: "/workspace", icon: LayoutGrid },
    { label: "项目", href: "/projects", icon: FolderKanban },
  ];

  return <><nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-popover/95 px-2 backdrop-blur md:hidden">{items.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-w-14 flex-col items-center gap-1 px-2 py-1 text-[10px]", pathname === href || pathname.startsWith(`${href}/`) ? "text-primary" : "text-muted-foreground")}><Icon className="size-4" /><span>{label}</span></Link>)}<button type="button" onClick={() => window.dispatchEvent(new Event("shadowpm:open-command"))} className="flex min-w-14 flex-col items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground"><Search className="size-4" /><span>搜索</span></button><button type="button" onClick={() => setMoreOpen((current) => !current)} className={cn("flex min-w-14 flex-col items-center gap-1 px-2 py-1 text-[10px]", moreOpen ? "text-primary" : "text-muted-foreground")}><MoreHorizontal className="size-4" /><span>更多</span></button></nav>
    {moreOpen && <div className="fixed inset-x-3 bottom-20 z-40 rounded-lg border border-border bg-popover p-2 shadow-[0_16px_40px_rgba(0,5,18,0.4)] md:hidden"><div className="grid grid-cols-2 gap-1">{userRole === "LEADER" && <Link href="/dashboard" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-accent"><BarChart3 className="size-4 text-primary" />管理总览</Link>}<Link href="/guide" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-accent"><MoreHorizontal className="size-4 text-primary" />帮助与反馈</Link></div></div>}</>;
}
