"use client";

import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setProjectBudgetPool } from "@/actions/budget-pool-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

  async function submit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await setProjectBudgetPool(formData);
      if (!result.success) {
        toast.error(result.message ?? "预算池保存失败");
        return;
      }
      toast.success(result.message ?? "预算池已保存");
      setOpen(false);
    } catch {
      toast.error("预算池保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}><Landmark className="size-4" />{triggerLabel}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12">
            <DialogTitle>项目总预算</DialogTitle>
            <DialogDescription className="mt-1 leading-6">确认后，预算池会成为预算规划的上限；已确认预算的改动需要留下原因。</DialogDescription>
          </DialogHeader>
          <form className="space-y-5 px-5 py-5" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
            <input type="hidden" name="projectId" value={projectId} />
            <label className="block space-y-2"><span className="text-sm font-medium">预算状态</span><Select name="budgetMode" defaultValue={mode}><option value="CONFIRMED">已有明确预算</option><option value="PENDING">预算待确认</option><option value="NOT_MANAGED">本项目不管理预算</option></Select><p className="text-xs leading-5 text-muted-foreground">预算待确认与不管理预算均不会被误解为 0 元预算。</p></label>
            <label className="block space-y-2"><span className="text-sm font-medium">项目总预算</span><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">¥</span><Input name="totalBudget" inputMode="decimal" type="number" min="0" step="0.01" defaultValue={totalBudget} required className="h-11 pl-7 font-mono tabular-nums" aria-describedby="budget-amount-help" /></div><p id="budget-amount-help" className="text-xs leading-5 text-muted-foreground">已编排预算不能超过这个金额。</p></label>
            <label className="block space-y-2"><span className="text-sm font-medium">变更原因 <span className="ml-1 font-normal text-muted-foreground">首次确认或草稿调整可留空</span></span><Textarea name="reason" rows={3} placeholder="例如：报价更新，预算池下调" className="min-h-[84px] resize-none text-sm" /></label>
            <DialogFooter className="border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button type="submit" disabled={submitting} className="gap-2">{submitting && <Loader2 className="size-4 animate-spin" />}保存预算池</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
