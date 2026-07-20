"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOverlayA11y } from "@/components/ui/use-overlay-a11y";

interface DialogContextValue {
  setOpen: (value: boolean) => void;
  titleId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("Dialog compound components must be used within <Dialog>");
  return context;
}

function Dialog({ open: controlledOpen, onOpenChange, defaultOpen = false, children }: { open?: boolean; onOpenChange?: (value: boolean) => void; defaultOpen?: boolean; children: React.ReactNode }) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const titleId = React.useId();
  const setOpen = React.useCallback((value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }, [controlledOpen, onOpenChange]);

  if (!open) return null;
  return <DialogContext.Provider value={{ setOpen, titleId }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setOpen } = useDialog();
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) });
  }
  return <Button variant="outline" onClick={() => setOpen(true)}>{children}</Button>;
}

function DialogOverlay({ className }: { className?: string }) {
  const { setOpen } = useDialog();
  return <button type="button" aria-label="点击遮罩关闭对话框" className={cn("fixed inset-0 z-50 cursor-default bg-canvas/78 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0", className)} onClick={() => setOpen(false)} />;
}

function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { setOpen, titleId } = useDialog();
  const contentRef = React.useRef<HTMLDivElement>(null);
  useOverlayA11y({ open: true, containerRef: contentRef, onClose: () => setOpen(false) });

  return <><DialogOverlay /><div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"><div ref={contentRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cn("pointer-events-auto relative z-50 w-full max-w-lg rounded-t-[12px] border border-border bg-popover p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)] outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:rounded-[12px] sm:p-6", className)}><Button variant="ghost" size="icon" className="absolute right-2 top-2 size-8 text-muted-foreground" onClick={() => setOpen(false)} aria-label="关闭对话框"><XIcon className="size-4" /></Button>{children}</div></div></>;
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-1.5", className)} {...props} />; }
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />; }
function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) { const { titleId } = useDialog(); return <h2 id={titleId} className={cn("text-lg font-semibold", className)} {...props} />; }
function DialogDescription({ className, ...props }: React.ComponentProps<"p">) { return <p className={cn("text-sm text-muted-foreground", className)} {...props} />; }

export { Dialog, DialogTrigger, DialogContent, DialogOverlay, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
