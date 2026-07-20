"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/BrandMark";

export function Header() {
  const pathname = usePathname();
  const openCommand = () => window.dispatchEvent(new Event("shadowpm:open-command"));
  const isProjectDetail = /^\/projects\/[^/]+$/.test(pathname);

  return <header className={`sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-canvas/88 px-4 backdrop-blur-xl md:grid md:grid-cols-[1fr_minmax(320px,560px)_1fr] md:px-7 ${isProjectDetail ? "max-md:hidden" : ""}`}><div className="md:hidden"><BrandMark className="size-7 [&_svg]:size-4" /></div><button type="button" onClick={openCommand} className="hidden h-9 items-center gap-2 rounded-md border border-border bg-surface-1/80 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-input hover:bg-surface-2 md:flex"><Search className="size-4" /><span className="flex-1">搜索项目、事项，或输入命令...</span><kbd className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘ K</kbd></button><button type="button" aria-label="打开搜索" onClick={openCommand} className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground md:hidden"><Search className="size-5" /></button><div className="hidden md:block" /></header>;
}
