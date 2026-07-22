"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOverlayA11y } from "@/components/ui/use-overlay-a11y";

type SheetContextValue = { setOpen: (open: boolean) => void; titleId: string };
const SheetContext = React.createContext<SheetContextValue | null>(null);
type SheetSize = "auto" | "medium" | "large" | "full";

const mobileSizeClass: Record<SheetSize, string> = {
  auto: "max-md:h-auto max-md:max-h-[min(60dvh,520px)]",
  medium: "max-md:h-[min(68dvh,600px)]",
  large: "max-md:h-[min(88dvh,760px)]",
  full: "max-md:h-[100dvh] max-md:rounded-none",
};

export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const titleId = React.useId();
  if (!open) return null;
  return <SheetContext.Provider value={{ setOpen: onOpenChange, titleId }}>{children}</SheetContext.Provider>;
}

export function SheetContent({ children, className, size = "large" }: { children: React.ReactNode; className?: string; size?: SheetSize }) {
  const context = React.useContext(SheetContext);
  const contentRef = React.useRef<HTMLElement>(null);
  if (!context) throw new Error("SheetContent must be used within Sheet");
  useOverlayA11y({ open: true, containerRef: contentRef, onClose: () => context.setOpen(false) });
  return <><button type="button" className="fixed inset-0 z-50 cursor-default bg-canvas/78 backdrop-blur-[2px]" aria-label="关闭详情" onClick={() => context.setOpen(false)} /><aside ref={contentRef} role="dialog" aria-modal="true" aria-labelledby={context.titleId} tabIndex={-1} className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-popover shadow-[-20px_0_60px_rgba(0,0,0,0.35)] outline-none motion-safe:animate-in motion-safe:slide-in-from-right max-md:inset-x-0 max-md:top-auto max-md:max-w-none max-md:rounded-t-[12px] max-md:border-x-0 max-md:border-b-0 max-md:motion-safe:slide-in-from-bottom", mobileSizeClass[size], className)}><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 z-10 size-8 text-muted-foreground" onClick={() => context.setOpen(false)} aria-label="关闭详情"><X className="size-4" /></Button>{children}</aside></>;
}

export function SheetHeader({ title, description }: { title: string; description?: string }) { const context = React.useContext(SheetContext); if (!context) throw new Error("SheetHeader must be used within Sheet"); return <header className="border-b border-border px-5 py-4 pr-14"><h2 id={context.titleId} className="text-base font-semibold">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}</header>; }
