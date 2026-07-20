"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createBudgetItem } from "@/actions/budget-item-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TaskOption = { id: string; name: string };

export function BudgetItemInlineForm({ projectId, tasks }: { projectId: string; tasks: TaskOption[] }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(formData: FormData) {
    const result = await createBudgetItem({
      projectId,
      title: String(formData.get("title") ?? ""),
      plannedAmount: String(formData.get("plannedAmount") ?? ""),
      category: String(formData.get("category") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
      taskIds: formData.get("taskId") ? [String(formData.get("taskId"))] : [],
    });
    if (!result.success) {
      toast.error(result.message ?? "预算项保存失败");
      return false;
    }
    toast.success(result.message ?? "预算草稿已保存");
    return true;
  }

  if (!open) {
    return <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="size-3.5" />添加预算项</Button>;
  }

  return (
    <form className="grid gap-2 border-y border-primary/25 bg-primary/[0.035] px-3 py-3 md:grid-cols-[minmax(150px,1.25fr)_minmax(120px,.7fr)_minmax(100px,.6fr)_minmax(130px,.9fr)_auto]" onSubmit={async (event) => {
      event.preventDefault();
      setSubmitting(true);
      try {
        if (await submit(new FormData(event.currentTarget))) {
          event.currentTarget.reset();
          setOpen(false);
        }
      } catch {
        toast.error("预算项保存失败，请重试");
      } finally {
        setSubmitting(false);
      }
    }}>
      <Input name="title" autoFocus required placeholder="预算项名称" className="h-9" />
      <Input name="plannedAmount" required inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="计划金额" className="h-9" />
      <Input name="category" placeholder="分类" className="h-9" />
      <Select name="taskId" defaultValue="" className="h-9"><option value="">暂不关联事项</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</Select>
      <div className="flex gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button type="submit" size="sm" disabled={submitting} className="gap-1.5">{submitting && <Loader2 className="size-3.5 animate-spin" />}保存</Button></div>
      <Input name="description" placeholder="说明（可选）" className="h-9 md:col-span-4" />
    </form>
  );
}
