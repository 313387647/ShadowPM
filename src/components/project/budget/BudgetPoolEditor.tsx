"use client";

import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setProjectBudgetPool } from "@/actions/budget-pool-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BudgetMode = "PENDING" | "CONFIRMED" | "NOT_MANAGED";

export function BudgetPoolEditor({
  projectId,
  mode,
  totalBudget,
  triggerLabel = "确认项目总预算",
}: {
  projectId: string;
  mode: BudgetMode;
  totalBudget: number;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMode, setSelectedMode] = useState<BudgetMode>(mode);
  const needsReason = selectedMode === "CONFIRMED" || mode === "CONFIRMED";

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setSelectedMode(mode);
    setOpen(nextOpen);
  }

  async function submit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await setProjectBudgetPool(formData);
      if (!result.success) {
        toast.error(result.message ?? "预算池保存失败");
        return;
      }
      toast.success(result.message ?? "预算池已保存");
      handleOpenChange(false);
    } catch {
      toast.error("预算池保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button className="gap-2" onClick={() => handleOpenChange(true)}><Landmark className="size-4" />{triggerLabel}</Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12">
            <DialogTitle>项目总预算</DialogTitle>
            <DialogDescription className="mt-1 leading-6">先确认项目是否管理预算；只有已有明确预算时才需要填写金额。</DialogDescription>
          </DialogHeader>
          <form className="space-y-5 px-5 py-5" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
            <input type="hidden" name="projectId" value={projectId} />
            <fieldset className="space-y-2"><legend className="text-sm font-medium">预算状态</legend><div className="grid gap-2"><BudgetModeOption value="CONFIRMED" selected={selectedMode} onChange={setSelectedMode} label="已有明确预算" description="确认项目总预算，并开始编排预算项。" /><BudgetModeOption value="PENDING" selected={selectedMode} onChange={setSelectedMode} label="预算待确认" description="先推进事项和日历，金额确定后再启用。" /><BudgetModeOption value="NOT_MANAGED" selected={selectedMode} onChange={setSelectedMode} label="本项目不管理预算" description="不展示金额，也不会被当作 0 元预算。" /></div></fieldset>
            <input type="hidden" name="budgetMode" value={selectedMode} />
            {selectedMode === "CONFIRMED" && <label className="block space-y-2"><span className="text-sm font-medium">项目总预算</span><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">¥</span><Input name="totalBudget" inputMode="decimal" type="number" min="0.01" step="0.01" defaultValue={totalBudget || ""} required className="h-11 pl-7 font-mono tabular-nums" aria-describedby="budget-amount-help" /></div><p id="budget-amount-help" className="text-xs leading-5 text-muted-foreground">已编排预算不能超过这个金额。</p></label>}
            {needsReason && <label className="block space-y-2"><span className="text-sm font-medium">变更原因 <span className="ml-1 font-normal text-muted-foreground">首次确认可留空</span></span><Textarea name="reason" rows={3} required={mode === "CONFIRMED" && selectedMode !== "CONFIRMED"} placeholder="例如：报价更新，预算池下调" className="min-h-[84px] resize-none text-sm" /></label>}
            <DialogFooter className="border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>取消</Button><Button type="submit" disabled={submitting} className="gap-2">{submitting && <Loader2 className="size-4 animate-spin" />}{selectedMode === "CONFIRMED" ? "确认预算池" : "保存状态"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BudgetModeOption({ value, selected, onChange, label, description }: { value: BudgetMode; selected: BudgetMode; onChange: (value: BudgetMode) => void; label: string; description: string }) {
  const active = selected === value;
  return <label className={active ? "flex cursor-pointer items-start gap-3 rounded-lg border border-primary/40 bg-primary/[0.06] px-3 py-3" : "flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-surface-2"}><input type="radio" className="mt-0.5 accent-primary" checked={active} onChange={() => onChange(value)} /><span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span></span></label>;
}
