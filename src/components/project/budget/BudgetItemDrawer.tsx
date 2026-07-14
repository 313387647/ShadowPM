"use client";

import { useState } from "react";
import { Check, CircleDollarSign, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { recordBudgetFlow } from "@/actions/budget-flow-actions";
import { updateBudgetItem } from "@/actions/budget-item-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBudgetMoney } from "./BudgetOverview";

type TaskOption = { id: string; name: string };
type BudgetItem = {
  id: string;
  title: string;
  category: string | null;
  plannedAmount: number;
  actualSpend: number;
  remaining: number;
  status: "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "SETTLED" | "CANCELED";
  description: string | null;
  source: string;
  aiConfidence: string | null;
  sourceRef: string | null;
  createdBy: string;
  updatedAt: string;
  taskIds: string[];
  taskNames: string[];
};
type Flow = { id: string; budgetItemId: string | null; action: string | null; amount: number; counterparty: string | null; description: string; createdBy: string; createdAt: string };

const STATUS_LABEL: Record<BudgetItem["status"], string> = { DRAFT: "草稿", CONFIRMED: "已确认", IN_PROGRESS: "执行中", SETTLED: "已结算", CANCELED: "已取消" };

export function BudgetItemDrawer({ item, flows, tasks, canEdit, canManage, open, onOpenChange }: { item: BudgetItem | null; flows: Flow[]; tasks: TaskOption[]; canEdit: boolean; canManage: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [flowAction, setFlowAction] = useState("EXPENSE_RECORDED");
  if (!item) return null;
  const itemFlows = flows.filter((flow) => flow.budgetItemId === item.id);

  async function saveItem(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await updateBudgetItem(formData);
      if (!result.success) return toast.error(result.message ?? "预算项更新失败");
      toast.success(result.message ?? "预算项已更新");
      onOpenChange(false);
    } catch {
      toast.error("预算项更新失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveFlow(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await recordBudgetFlow(formData);
      if (!result.success) return toast.error(result.message ?? "资金动作保存失败");
      toast.success(result.message ?? "资金动作已记录");
      onOpenChange(false);
    } catch {
      toast.error("资金动作保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0"><div className="p-5 sm:p-6"><DialogHeader><div className="flex flex-wrap items-center gap-2 pr-8"><DialogTitle>{item.title}</DialogTitle><Badge variant="outline">{STATUS_LABEL[item.status]}</Badge></div><DialogDescription>预算项独立存在，关联事项仅用于补充工作上下文。</DialogDescription></DialogHeader>
    <div className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border bg-canvas/25 text-center"><div className="p-3"><p className="text-[11px] text-muted-foreground">计划金额</p><p className="mt-1 font-mono text-sm font-medium">{formatBudgetMoney(item.plannedAmount)}</p></div><div className="p-3"><p className="text-[11px] text-muted-foreground">实际支出</p><p className="mt-1 font-mono text-sm font-medium">{formatBudgetMoney(item.actualSpend)}</p></div><div className="p-3"><p className="text-[11px] text-muted-foreground">可用余额</p><p className="mt-1 font-mono text-sm font-medium">{formatBudgetMoney(item.remaining)}</p></div></div></div>
    {canEdit && item.status !== "CANCELED" && <form className="space-y-3 border-t border-border px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); void saveItem(new FormData(event.currentTarget)); }}><div className="flex items-center justify-between"><h3 className="text-sm font-medium">预算项详情与关联</h3><span className="text-[11px] text-muted-foreground">确认后金额变更需要原因。</span></div><input type="hidden" name="budgetItemId" value={item.id} /><input type="hidden" name="status" value={item.status} />
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs text-muted-foreground">预算项名称</span><input name="title" defaultValue={item.title} className="form-input h-9" /></label><label className="space-y-1"><span className="text-xs text-muted-foreground">计划金额</span><input name="plannedAmount" type="number" min="0.01" step="0.01" defaultValue={item.plannedAmount} className="form-input h-9" /></label><label className="space-y-1"><span className="text-xs text-muted-foreground">分类</span><input name="category" defaultValue={item.category ?? ""} className="form-input h-9" /></label><label className="space-y-1"><span className="text-xs text-muted-foreground">修改原因</span><input name="reason" placeholder={item.status === "DRAFT" ? "草稿可不填" : "已确认项的金额改动必填"} className="form-input h-9" /></label></div>
      <label className="block space-y-1"><span className="text-xs text-muted-foreground">说明</span><textarea name="description" defaultValue={item.description ?? ""} rows={2} className="form-input resize-none" /></label>
      <fieldset><legend className="text-xs text-muted-foreground">关联管控事项（可不选、可多选）</legend><div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">{tasks.map((task) => <label key={task.id} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"><input type="checkbox" name="taskIds" value={task.id} defaultChecked={item.taskIds.includes(task.id)} />{task.name}</label>)}</div></fieldset>
      <div className="flex justify-end"><Button type="submit" size="sm" disabled={submitting} className="gap-1.5">{submitting && <Loader2 className="size-3.5 animate-spin" />}保存普通字段</Button></div>
    </form>}
    {canManage && item.status === "DRAFT" && <form className="flex flex-wrap items-center justify-between gap-3 border-t border-success/20 bg-success/[0.035] px-5 py-4 sm:px-6" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); formData.set("status", "CONFIRMED"); void saveItem(formData); }}><input type="hidden" name="budgetItemId" value={item.id} /><input type="hidden" name="title" value={item.title} /><input type="hidden" name="plannedAmount" value={item.plannedAmount} /><input type="hidden" name="category" value={item.category ?? ""} /><input type="hidden" name="description" value={item.description ?? ""} />{item.taskIds.map((taskId) => <input key={taskId} type="hidden" name="taskIds" value={taskId} />)}<div><p className="text-sm font-medium text-success">确认该预算项</p><p className="mt-1 text-xs text-muted-foreground">确认后占用预算池，金额变更需写明原因。</p></div><Button type="submit" size="sm" disabled={submitting} className="gap-1.5"><Check className="size-3.5" />确认预算项</Button></form>}
    {canEdit && ["CONFIRMED", "IN_PROGRESS", "SETTLED"].includes(item.status) && <form className="space-y-3 border-t border-border px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); void saveFlow(new FormData(event.currentTarget)); }}><div className="flex items-center gap-2"><CircleDollarSign className="size-4 text-primary" /><h3 className="text-sm font-medium">记录资金动作</h3></div><input type="hidden" name="budgetItemId" value={item.id} /><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs text-muted-foreground">动作</span><select name="action" value={flowAction} onChange={(event) => setFlowAction(event.target.value)} className="form-input h-9"><option value="APPROVAL_RECORDED">报批通过</option><option value="TRANSFER_RECORDED">划拨给第三方</option><option value="EXPENSE_RECORDED">记录实际支出</option><option value="REFUND_RECORDED">记录退款</option><option value="SETTLED">验收并结算</option><option value="REVERSED">撤回上一动作</option></select></label><label className="space-y-1"><span className="text-xs text-muted-foreground">金额</span><input name="amount" type="number" min="0.01" step="0.01" required className="form-input h-9" /></label>{flowAction === "TRANSFER_RECORDED" && <label className="space-y-1 sm:col-span-2"><span className="text-xs text-muted-foreground">接收部门或合作方</span><input name="counterparty" required className="form-input h-9" /></label>}</div><label className="block space-y-1"><span className="text-xs text-muted-foreground">说明</span><textarea name="description" required rows={2} placeholder="例如：供应商首付款已审批并支付" className="form-input resize-none" /></label><div className="flex justify-end"><Button type="submit" size="sm" disabled={submitting} className="gap-1.5">{submitting && <Loader2 className="size-3.5 animate-spin" />}记录动作</Button></div></form>}
    {canManage && item.status !== "DRAFT" && item.status !== "CANCELED" && <form className="border-t border-destructive/20 bg-destructive/[0.035] px-5 py-4 sm:px-6" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); formData.set("status", "CANCELED"); void saveItem(formData); }}><input type="hidden" name="budgetItemId" value={item.id} /><input type="hidden" name="title" value={item.title} /><input type="hidden" name="plannedAmount" value={item.plannedAmount} /><input type="hidden" name="category" value={item.category ?? ""} /><input type="hidden" name="description" value={item.description ?? ""} />{item.taskIds.map((taskId) => <input key={taskId} type="hidden" name="taskIds" value={taskId} />)}<div className="flex flex-wrap items-end gap-3"><label className="min-w-[220px] flex-1 space-y-1"><span className="text-xs font-medium text-destructive">取消原因（必填）</span><input name="reason" required placeholder="例如：项目取消，释放该预算项" className="form-input h-9" /></label><Button type="submit" size="sm" variant="destructive" disabled={submitting} className="gap-1.5"><XCircle className="size-3.5" />取消预算项</Button></div></form>}
    <section className="border-t border-border px-5 py-5 sm:px-6"><h3 className="text-sm font-medium">来源与历史</h3><div className="mt-2 space-y-2 text-xs text-muted-foreground"><p>创建人：{item.createdBy} · 最近更新：{new Date(item.updatedAt).toLocaleString("zh-CN")}</p>{item.source === "AI_IMPORT" && <p>AI 来源：{item.sourceRef ?? "未定位"} · 置信度：{item.aiConfidence ?? "未标注"}</p>}{itemFlows.length ? itemFlows.map((flow) => <div key={flow.id} className="border-l-2 border-primary/30 pl-3"><p className="font-medium text-foreground">{flow.action ?? "历史资金动作"} · {formatBudgetMoney(flow.amount)}</p><p className="mt-1">{flow.description}{flow.counterparty ? ` · ${flow.counterparty}` : ""} · {flow.createdBy}</p></div>) : <p>尚无资金动作记录。</p>}</div></section>
  </DialogContent></Dialog>;
}
