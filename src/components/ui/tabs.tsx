"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onChange: (v: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs>")
  return ctx
}

// ── Root ──
interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (v: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const value = controlledValue ?? internalValue

  const onChange = React.useCallback(
    (v: string) => {
      if (controlledValue === undefined) setInternalValue(v)
      onValueChange?.(v)
    },
    [controlledValue, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

// ── List ──
function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex h-10 w-full items-center justify-start gap-5 border-b border-border text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

// ── Trigger ──
function TabsTrigger({
  value,
  className,
  children,
  disabled,
}: {
  value: string
  className?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const { value: selected, onChange } = useTabs()
  const isActive = selected === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={cn(
        "relative inline-flex h-10 items-center justify-center gap-1.5 border-b-2 border-transparent px-0 text-sm font-medium whitespace-nowrap transition-colors",
        "hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "border-primary text-foreground"
          : "text-muted-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

// ── Content ──
function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const { value: selected } = useTabs()
  if (selected !== value) return null

  return (
    <div
      role="tabpanel"
      className={cn("mt-4 outline-none", className)}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
