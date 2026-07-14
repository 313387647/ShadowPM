"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightLeft, CircleDollarSign, Landmark, Loader2, Pencil, Split } from "lucide-react";
import { toast } from "sonner";
import { updateProjectBudgetPool, updateTaskBudget, splitTaskBudget } from "@/actions/ledger-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BudgetTask = {
  id: string;
  name: string;
  projectStatus: string;
  workstream: string | null;
  budgetAmount: number;
  budgetStatus: "UNALLOCATED" | "ALLOCATED" | "APPROVED" | "DISBURSED" | "ACCEPTED" | "CANCELED";
  budgetRecipient: string | null;
  updatedAt: string;
};

type BudgetControl = {
  projectId: string;
  pool: { amount: number; confirmedAmount: number; status: "UNCONFIRMED" | "CONFIRMED" | "CANCELED" };
  allocated: number;
  remaining: number;
  disbursed: number;
  tasks: BudgetTask[];
};

const TASK_BUDGET_LABEL: Record<BudgetTask["budgetStatus"], string> = {
  UNALLOCATED: "未分配",
  ALLOCATED: "已分配",
  APPROVED: "报批通过",
  DISBURSED: "已划拨",
  ACCEPTED: "已验收",
  CANCELED: "已取消",
};
const PROJECT_BUDGET_LABEL: Record<BudgetControl["pool"]["status"], string> = {
  UNCONFIRMED: "未确认",
  CONFIRMED: "已确认",
  CANCELED: "已取消",
};

function money(value: number) {
  return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function statusClass(status: BudgetTask["budgetStatus"]) {
  if (status === "ACCEPTED") return "border-success/30 bg-success/10 text-success";
  if (status === "DISBURSED") return "border-info/30 bg-info/10 text-info";
  if (status === "CANCELED") return "border-muted bg-muted text-muted-foreground";
  if (status === "APPROVED") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "ALLOCATED") return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-secondary text-muted-foreground";
}

export function LedgerTable({ data, canEdit }: { data: BudgetControl; canEdit: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [poolOpen, setPoolOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<BudgetTask | null>(null);
  const [splittingTask, setSplittingTask] = useState<BudgetTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const taskId = searchParams.get("ledgerTask");
    if (!taskId || !data.tasks.some((task) => task.id === taskId)) return;
    setFocusedTaskId(taskId);
    document.getElementById(`budget-task-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setFocusedTaskId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [data.tasks, searchParams]);

  async function submit(action: (formData: FormData) => Promise<{ success: boolean; message?: string }>, formData: FormData, onSuccess: () => void) {
    setSubmitting(true);
    try {
      const result = await action(formData);
      if (result.success) {
        toast.success(result.message ?? "预算已更新");
        onSuccess();
        router.refresh();
      } else {
        toast.error(result.message ?? "预算更新失败");
      }
    } catch {
      toast.error("预算更新失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">预算管控表</h2>
          <p className="mt-1 text-sm text-muted-foreground">先确认项目预算池，再分配到事项；所有改动必须填写原因，并统一沉淀到项目活动。</p>
        </div>
        {canEdit && <Button className="gap-2" onClick={() => setPoolOpen(true)}><Landmark className="size-4" />管理预算池</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BudgetMetric icon={<Landmark className="size-4" />} label="项目预算池" value={money(data.pool.confirmedAmount)} note={PROJECT_BUDGET_LABEL[data.pool.status]} tone={data.pool.status === "CONFIRMED" ? "success" : "default"} />
        <BudgetMetric icon={<ArrowRightLeft className="size-4" />} label="已分配到事项" value={money(data.allocated)} note={data.pool.status === "CONFIRMED" ? `剩余 ${money(data.remaining)}` : "确认预算池后可分配"} tone={data.remaining < 0 ? "danger" : "default"} />
        <BudgetMetric icon={<CircleDollarSign className="size-4" />} label="已划拨执行" value={money(data.disbursed)} note="仅统计已划拨给第三方的事项" tone="default" />
      </div>

      {data.pool.status !== "CONFIRMED" && (
        <div className="rounded-xl border border-border bg-secondary/45 px-4 py-3 text-sm text-muted-foreground">
          当前没有可用预算池。确认预算池后，才能为具体管控事项填写预算与执行状态。
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b border-border bg-secondary/55 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">管控事项</th>
                <th className="px-4 py-3 font-medium text-right">当前预算</th>
                <th className="px-4 py-3 font-medium">预算状态</th>
                <th className="px-4 py-3 font-medium">划拨对象</th>
                <th className="px-4 py-3 font-medium">最近更新</th>
                {canEdit && <th className="px-4 py-3 text-right font-medium">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.tasks.map((task) => (
                <tr id={`budget-task-${task.id}`} key={task.id} className={cn("transition-colors hover:bg-secondary/35", focusedTaskId === task.id && "bg-primary/8 ring-1 ring-inset ring-primary/30")}>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-foreground">{task.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.workstream ?? "未分模块"}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums">{money(task.budgetAmount)}</td>
                  <td className="px-4 py-3.5"><Badge variant="outline" className={statusClass(task.budgetStatus)}>{TASK_BUDGET_LABEL[task.budgetStatus]}</Badge></td>
                  <td className="px-4 py-3.5 text-muted-foreground">{task.budgetRecipient ?? "-"}</td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(task.updatedAt).toLocaleDateString("zh-CN")}</td>
                  {canEdit && <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" disabled={data.pool.status !== "CONFIRMED"} onClick={() => setEditingTask(task)}><Pencil className="size-3.5" />编辑</Button><Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" disabled={data.pool.status !== "CONFIRMED" || task.budgetAmount <= 0 || ["UNALLOCATED", "CANCELED"].includes(task.budgetStatus)} onClick={() => setSplittingTask(task)}><Split className="size-3.5" />拆分</Button></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">项目取消时，先收回或取消所有事项预算，再将项目预算池设为“已取消”。历史金额和原因不会丢失，仍可在“项目活动”中追溯。</p>

      <Dialog open={poolOpen} onOpenChange={setPoolOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>管理项目预算池</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(updateProjectBudgetPool, new FormData(event.currentTarget), () => setPoolOpen(false)); }}>
            <input type="hidden" name="projectId" value={data.projectId} />
            <FormField label="预算池状态"><select name="budgetStatus" defaultValue={data.pool.status} className="form-input"><option value="CONFIRMED">已确认</option><option value="UNCONFIRMED">未确认</option><option value="CANCELED">已取消</option></select></FormField>
            <FormField label="当前预算池金额 (¥)"><input name="amount" type="number" min="0" step="0.01" defaultValue={data.pool.amount} required className="form-input" /></FormField>
            <FormField label="调整原因"><textarea name="reason" required rows={3} placeholder="例如：供应商报价缩减，项目总预算下调" className="form-input resize-none" /></FormField>
            <DialogFooter submitting={submitting} onCancel={() => setPoolOpen(false)} label="保存预算池" />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingTask)} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑事项预算</DialogTitle></DialogHeader>
          {editingTask && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(updateTaskBudget, new FormData(event.currentTarget), () => setEditingTask(null)); }}>
            <input type="hidden" name="taskId" value={editingTask.id} />
            <div className="rounded-lg bg-secondary/55 px-3 py-2 text-sm font-medium">{editingTask.name}</div>
            <FormField label="当前预算 (¥)"><input name="amount" type="number" min="0" step="0.01" defaultValue={editingTask.budgetAmount} required className="form-input" /></FormField>
            <FormField label="预算状态"><select name="budgetStatus" defaultValue={editingTask.budgetStatus} className="form-input"><option value="UNALLOCATED">未分配</option><option value="ALLOCATED">已分配</option><option value="APPROVED">报批通过</option><option value="DISBURSED">已划拨给第三方</option><option value="ACCEPTED">已验收</option><option value="CANCELED">已取消</option></select></FormField>
            <FormField label="划拨对象（仅划拨时填写）"><input name="budgetRecipient" defaultValue={editingTask.budgetRecipient ?? ""} placeholder="合作方、供应商或其他部门" className="form-input" /></FormField>
            <FormField label="调整原因"><textarea name="reason" required rows={3} placeholder="例如：砍掉线下物料预算，退回项目预算池" className="form-input resize-none" /></FormField>
            <DialogFooter submitting={submitting} onCancel={() => setEditingTask(null)} label="保存事项预算" />
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(splittingTask)} onOpenChange={(open) => !open && setSplittingTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>拆分事项预算</DialogTitle></DialogHeader>
          {splittingTask && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(splitTaskBudget, new FormData(event.currentTarget), () => setSplittingTask(null)); }}>
            <input type="hidden" name="sourceTaskId" value={splittingTask.id} />
            <div className="rounded-lg bg-secondary/55 px-3 py-2 text-sm">从 <span className="font-medium">{splittingTask.name}</span> 拆出，当前可拆分 {money(splittingTask.budgetAmount)}</div>
            <FormField label="目标事项"><select name="targetTaskId" required className="form-input"><option value="">请选择目标事项</option>{data.tasks.filter((task) => task.id !== splittingTask.id && task.budgetStatus !== "CANCELED").map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select></FormField>
            <FormField label="拆分金额 (¥)"><input name="amount" type="number" min="0.01" max={splittingTask.budgetAmount} step="0.01" required className="form-input" /></FormField>
            <FormField label="拆分原因"><textarea name="reason" required rows={3} placeholder="例如：将投放预算拆分给海外媒体采购事项" className="form-input resize-none" /></FormField>
            <DialogFooter submitting={submitting} onCancel={() => setSplittingTask(null)} label="确认拆分" />
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BudgetMetric({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: "default" | "success" | "danger" }) {
  return <Card><CardContent className="pt-5"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>;
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function DialogFooter({ submitting, onCancel, label }: { submitting: boolean; onCancel: () => void; label: string }) {
  return <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={onCancel}>取消</Button><Button type="submit" disabled={submitting} className="gap-1.5">{submitting && <Loader2 className="size-3.5 animate-spin" />}{label}</Button></div>;
}
