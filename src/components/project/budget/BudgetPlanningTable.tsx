"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDraftBudgetItem, updateBudgetItem } from "@/actions/budget-item-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BudgetBulkPasteDialog } from "./BudgetBulkPasteDialog";
import { BudgetItemDrawer } from "./BudgetItemDrawer";
import { BudgetItemInlineForm } from "./BudgetItemInlineForm";
import { formatBudgetMoney } from "./BudgetOverview";

type TaskOption = { id: string; name: string };
type BudgetItem = {
  id: string; title: string; category: string | null; plannedAmount: number; actualSpend: number; remaining: number;
  status: "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "SETTLED" | "CANCELED"; description: string | null; source: string;
  aiConfidence: string | null; sourceRef: string | null; createdBy: string; updatedAt: string; taskIds: string[]; taskNames: string[];
};
type Flow = { id: string; budgetItemId: string | null; action: string | null; amount: number; counterparty: string | null; description: string; createdBy: string; createdAt: string };

const STATUS: Record<BudgetItem["status"], { label: string; className: string }> = {
  DRAFT: { label: "草稿", className: "border-border bg-secondary text-muted-foreground" },
  CONFIRMED: { label: "已确认", className: "border-primary/25 bg-primary/10 text-primary" },
  IN_PROGRESS: { label: "执行中", className: "border-info/25 bg-info/10 text-info" },
  SETTLED: { label: "已结算", className: "border-success/25 bg-success/10 text-success" },
  CANCELED: { label: "已取消", className: "border-muted bg-muted text-muted-foreground" },
};

export function BudgetPlanningTable({ projectId, items, flows, tasks, canEdit, canManage }: { projectId: string; items: BudgetItem[]; flows: Flow[]; tasks: TaskOption[]; canEdit: boolean; canManage: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerItem, setDrawerItem] = useState<BudgetItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function saveRow(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await updateBudgetItem(formData);
      if (!result.success) {
        toast.error(result.message ?? "预算项更新失败");
        return;
      }
      toast.success(result.message ?? "预算项已更新");
      setEditingId(null);
    } catch {
      toast.error("预算项更新失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeDraft(item: BudgetItem) {
    setSubmitting(true);
    try {
      const result = await deleteDraftBudgetItem(item.id);
      if (!result.success) return toast.error(result.message ?? "删除失败");
      toast.success(result.message ?? "草稿预算项已删除");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const toolbar = canEdit ? <div className="flex flex-wrap items-center gap-1"><BudgetItemInlineForm projectId={projectId} tasks={tasks} /><BudgetBulkPasteDialog projectId={projectId} /></div> : null;
  return <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold">预算规划</h2><p className="mt-1 text-sm text-muted-foreground">预算项独立存在；关联事项只补充工作上下文。</p></div>{toolbar}</div>
    {items.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-surface-1 px-5 py-12 text-center"><p className="font-medium">还没有预算项</p><p className="mt-1 text-sm text-muted-foreground">先快速添加一条，或从 Excel、粘贴文本和 AI 文件导入开始。</p></div> : <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface-1 md:block"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border bg-secondary/35 text-left text-[11px] text-muted-foreground"><tr><th className="px-4 py-3 font-medium">预算项 / 工作上下文</th><th className="px-4 py-3 text-right font-medium">计划金额</th><th className="px-4 py-3 text-right font-medium">执行情况</th><th className="px-4 py-3 font-medium">状态</th><th className="px-3 py-3 text-right font-medium">操作</th></tr></thead><tbody className="divide-y divide-border">{items.map((item) => editingId === item.id ? <EditRow key={item.id} item={item} submitting={submitting} onCancel={() => setEditingId(null)} onSave={saveRow} /> : <tr key={item.id} className="group transition-colors hover:bg-primary/[0.045]"><td className="max-w-[380px] px-4 py-3.5"><button type="button" className="max-w-full text-left" onClick={() => setDrawerItem(item)}><p className="truncate font-medium group-hover:text-primary">{item.title}</p><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{item.category ?? "未分类"}</span><span className="text-border">/</span><span className="truncate">{item.taskNames.length ? item.taskNames.join("、") : "暂未关联事项"}</span></div></button></td><td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums">{formatBudgetMoney(item.plannedAmount)}</td><td className="px-4 py-3.5 text-right"><p className="font-mono tabular-nums">{formatBudgetMoney(item.actualSpend)}</p><p className={item.remaining < 0 ? "mt-1 text-[11px] text-destructive" : "mt-1 text-[11px] text-muted-foreground"}>可用 {formatBudgetMoney(item.remaining)}</p></td><td className="px-4 py-3.5"><Badge variant="outline" className={STATUS[item.status].className}>{STATUS[item.status].label}</Badge></td><td className="px-3 py-3.5"><div className="flex justify-end gap-0.5">{canEdit && item.status !== "CANCELED" && <Button aria-label={`编辑 ${item.title}`} title="编辑普通字段" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => setEditingId(item.id)}><Pencil className="size-3.5" /></Button>}<Button aria-label={`查看 ${item.title} 详情`} title="查看详情与资金动作" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => setDrawerItem(item)}><MoreHorizontal className="size-4" /></Button>{canEdit && item.status === "DRAFT" && <Button aria-label={`删除 ${item.title}`} title="删除草稿预算项" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" disabled={submitting} onClick={() => setDeleteTarget(item)}><Trash2 className="size-3.5" /></Button>}</div></td></tr>)}</tbody></table></div></div>
      <div className="space-y-2 md:hidden">{items.map((item) => <article key={item.id} className="rounded-xl border border-border bg-surface-1 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.category ?? "未分类"} · {item.taskNames.length ? item.taskNames.join("、") : "暂未关联事项"}</p></div><Badge variant="outline" className={STATUS[item.status].className}>{STATUS[item.status].label}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div><p className="text-muted-foreground">计划</p><p className="mt-1 font-mono text-foreground">{formatBudgetMoney(item.plannedAmount)}</p></div><div><p className="text-muted-foreground">支出</p><p className="mt-1 font-mono text-foreground">{formatBudgetMoney(item.actualSpend)}</p></div><div><p className="text-muted-foreground">剩余</p><p className="mt-1 font-mono text-foreground">{formatBudgetMoney(item.remaining)}</p></div></div><div className="mt-3 flex justify-end gap-1">{canEdit && item.status !== "CANCELED" && <Button size="sm" variant="ghost" onClick={() => setDrawerItem(item)}>编辑</Button>}<Button size="sm" variant="ghost" onClick={() => setDrawerItem(item)}>详情</Button>{canEdit && item.status === "DRAFT" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeDraft(item)}>删除</Button>}</div></article>)}</div>
    </>}
    <BudgetItemDrawer item={drawerItem} flows={flows} tasks={tasks} canEdit={canEdit} canManage={canManage} open={Boolean(drawerItem)} onOpenChange={(open) => !open && setDrawerItem(null)} />
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>删除草稿预算项</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">删除「{deleteTarget?.title}」只会移除草稿预算项；项目活动会保留删除事实。</p><DialogFooter><Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="destructive" disabled={submitting || !deleteTarget} onClick={() => deleteTarget && void removeDraft(deleteTarget)}>{submitting ? "删除中" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function EditRow({ item, submitting, onCancel, onSave }: { item: BudgetItem; submitting: boolean; onCancel: () => void; onSave: (formData: FormData) => Promise<void> }) {
  return <tr className="bg-primary/5"><td colSpan={8} className="p-3"><form className="grid gap-2 lg:grid-cols-[1.1fr_.55fr_.55fr_1.25fr_auto]" onSubmit={(event) => { event.preventDefault(); void onSave(new FormData(event.currentTarget)); }}><input type="hidden" name="budgetItemId" value={item.id} /><input type="hidden" name="status" value={item.status} />{item.taskIds.map((taskId) => <input key={taskId} type="hidden" name="taskIds" value={taskId} />)}<input name="title" defaultValue={item.title} required className="form-input h-9" /><input name="plannedAmount" type="number" min="0.01" step="0.01" defaultValue={item.plannedAmount} required readOnly={item.status !== "DRAFT"} className={item.status === "DRAFT" ? "form-input h-9" : "form-input h-9 cursor-not-allowed opacity-65"} /><input name="category" defaultValue={item.category ?? ""} placeholder="分类" className="form-input h-9" /><input name="description" defaultValue={item.description ?? ""} placeholder={item.status === "DRAFT" ? "说明（可选）" : "说明；金额调整须在详情填写原因"} className="form-input h-9" /><div className="flex gap-1"><Button type="button" size="sm" variant="ghost" onClick={onCancel}>取消</Button><Button type="submit" size="sm" disabled={submitting} className="gap-1">{submitting && <Loader2 className="size-3.5 animate-spin" />}保存</Button></div></form>{item.status !== "DRAFT" && <p className="mt-2 text-xs text-muted-foreground">已确认预算项的金额变更需要原因，请在“详情”中完成。</p>}</td></tr>;
}
