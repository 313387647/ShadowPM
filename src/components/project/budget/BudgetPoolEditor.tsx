"use client";

import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setProjectBudgetPool } from "@/actions/budget-pool-actions";
import { Button } from "@/components/ui/button";
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>项目总预算</DialogTitle>
            <DialogDescription>预算池是全部预算项的上限。草稿可随时调整；已确认预算池的任何变更都需要留下原因。</DialogDescription>
          </DialogHeader>
          <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
            <input type="hidden" name="projectId" value={projectId} />
            <label className="block space-y-1.5"><span className="text-sm font-medium">预算状态</span><select name="budgetMode" defaultValue={mode} className="form-input"><option value="CONFIRMED">已有明确预算</option><option value="PENDING">预算待确认</option><option value="NOT_MANAGED">本项目不管理预算</option></select></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">项目总预算 (¥)</span><input name="totalBudget" inputMode="decimal" type="number" min="0" step="0.01" defaultValue={totalBudget} required className="form-input" /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">变更原因 <span className="font-normal text-muted-foreground">(首次确认与草稿阶段可不填)</span></span><textarea name="reason" rows={3} placeholder="例如：报价更新，预算池下调" className="form-input resize-none" /></label>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button type="submit" disabled={submitting} className="gap-2">{submitting && <Loader2 className="size-4 animate-spin" />}保存预算池</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
