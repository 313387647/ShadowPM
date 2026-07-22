"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useDismissablePopover } from "@/components/ui/use-dismissable-popover";
import { cn } from "@/lib/utils";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; className: string }> = [
  { value: "PENDING", label: "待启动", className: "border-warning/25 bg-warning/10 text-warning" },
  { value: "IN_PROGRESS", label: "进行中", className: "border-primary/25 bg-primary/10 text-primary" },
  { value: "COMPLETED", label: "已完成", className: "border-success/25 bg-success/10 text-success" },
];

export function TaskStatusMenu({ status, disabled = false, onChange }: { status: TaskStatus; disabled?: boolean; onChange: (status: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useDismissablePopover(open, () => setOpen(false));
  const current = STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];

  return <div ref={popoverRef} className="relative inline-flex" onClick={(event) => event.stopPropagation()}>
    <button type="button" disabled={disabled} onClick={() => setOpen((value) => !value)} className={cn("flex h-7 w-28 items-center justify-between rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", current.className)} aria-label={`更新事项状态：${current.label}`} aria-haspopup="menu" aria-expanded={open}>
      <span>{current.label}</span>
      <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
    </button>
    {open && <div role="menu" aria-label="选择事项状态" className="absolute left-0 top-8 z-30 w-32 overflow-hidden rounded-[10px] border border-border bg-popover p-1 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
      {STATUS_OPTIONS.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === status} onClick={() => { setOpen(false); if (option.value !== status) onChange(option.value); }} className={cn("flex min-h-9 w-full items-center justify-between rounded-md px-2 text-left text-sm text-foreground hover:bg-surface-2", option.value === status && "bg-surface-2")}>
        {option.label}
        {option.value === status && <Check className="size-3.5 text-primary" aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
