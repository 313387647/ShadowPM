"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

interface DialogContextValue {
  open: boolean
  setOpen: (v: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialog() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog compound components must be used within <Dialog>")
  return ctx
}

// ── Root ──
function Dialog({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = controlledOpen ?? internalOpen

  const setOpen = React.useCallback(
    (v: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(v)
      onOpenChange?.(v)
    },
    [controlledOpen, onOpenChange]
  )

  React.useEffect(() => {
    if (!open) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open, setOpen])

  if (!open) return null

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

// ── Trigger ──
function DialogTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode
  asChild?: boolean
}) {
  const { setOpen } = useDialog()
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(true),
    })
  }
  return (
    <Button variant="outline" onClick={() => setOpen(true)}>
      {children}
    </Button>
  )
}

// ── Portal / Overlay ──
function DialogOverlay({ className }: { className?: string }) {
  const { setOpen } = useDialog()
  return (
    <div
      className={cn("fixed inset-0 z-50 bg-canvas/80 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0", className)}
      onClick={() => setOpen(false)}
    />
  )
}

// ── Content ──
function DialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { setOpen } = useDialog()
  return (
    <>
      <DialogOverlay />
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4">
        <div
          className={cn(
            "pointer-events-auto relative z-50 w-full max-w-lg rounded-t-xl border border-primary/15 bg-popover p-6 shadow-[0_28px_80px_rgba(0,5,18,0.55)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:rounded-xl",
            className
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => setOpen(false)}
          >
            <XIcon className="size-4" />
          </Button>
          {children}
        </div>
      </div>
    </>
  )
}

// ── Header / Footer / Title / Description ──
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogOverlay,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
