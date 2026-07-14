"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SheetContextValue = { setOpen: (open: boolean) => void };
const SheetContext = React.createContext<SheetContextValue | null>(null);

export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onOpenChange, open]);
  if (!open) return null;
  return <SheetContext.Provider value={{ setOpen: onOpenChange }}>{children}</SheetContext.Provider>;
}

export function SheetContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error("SheetContent must be used within Sheet");
  return <><button type="button" className="fixed inset-0 z-50 cursor-default bg-canvas/75 backdrop-blur-[2px]" aria-label="关闭详情" onClick={() => context.setOpen(false)} /><aside className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-popover shadow-[-20px_0_60px_rgba(0,5,18,0.45)] motion-safe:animate-in motion-safe:slide-in-from-right", className)}><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 z-10 size-8" onClick={() => context.setOpen(false)} aria-label="关闭详情"><X className="size-4" /></Button>{children}</aside></>;
}

export function SheetHeader({ title, description }: { title: string; description?: string }) { return <header className="border-b border-border px-5 py-4 pr-14"><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</header>; }
