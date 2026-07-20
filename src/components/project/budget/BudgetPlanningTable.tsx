"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const drawerItem = items.find((item) => item.id === drawerItemId) ?? null;

  const toolbar = canEdit ? <div className="flex flex-wrap items-center gap-1"><BudgetItemInlineForm projectId={projectId} tasks={tasks} /><BudgetBulkPasteDialog projectId={projectId} /></div> : null;
  return <section className="space-y-3"><div className="flex justify-end">{toolbar}</div>
    {items.length === 0 ? <div className="border-y border-dashed border-border px-5 py-12 text-center"><p className="font-medium">还没有预算项</p><p className="mt-1 text-sm text-muted-foreground">添加一条预算项，或从 Excel、粘贴文本和 AI 文件导入开始。</p></div> : <>
      <div className="hidden overflow-hidden border-y border-border md:block"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border bg-secondary/35 text-left text-[11px] text-muted-foreground"><tr><th className="px-4 py-3 font-medium">预算项</th><th className="px-4 py-3 text-right font-medium">计划金额</th><th className="px-4 py-3 text-right font-medium">已支出 / 剩余</th><th className="px-4 py-3 font-medium">状态</th></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id} className="group cursor-pointer transition-colors hover:bg-primary/[0.045]" onClick={() => setDrawerItemId(item.id)}><td className="max-w-[380px] px-4 py-3.5"><p className="truncate font-medium group-hover:text-primary">{item.title}</p><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{item.category ?? "未分类"}</span><span className="text-border">/</span><span className="truncate">{item.taskNames.length ? item.taskNames.join("、") : "暂未关联事项"}</span></div></td><td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums">{formatBudgetMoney(item.plannedAmount)}</td><td className="px-4 py-3.5 text-right"><p className="font-mono tabular-nums">{formatBudgetMoney(item.actualSpend)}</p><p className={item.remaining < 0 ? "mt-1 text-[11px] text-destructive" : "mt-1 text-[11px] text-muted-foreground"}>剩余 {formatBudgetMoney(item.remaining)}</p></td><td className="px-4 py-3.5"><Badge variant="outline" className={STATUS[item.status].className}>{STATUS[item.status].label}</Badge></td></tr>)}</tbody></table></div></div>
      <div className="divide-y divide-border border-y border-border md:hidden">{items.map((item) => <button key={item.id} type="button" className="block w-full px-1 py-4 text-left transition-colors hover:bg-primary/[0.045]" onClick={() => setDrawerItemId(item.id)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{item.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.category ?? "未分类"} · {item.taskNames.length ? item.taskNames.join("、") : "暂未关联事项"}</p></div><Badge variant="outline" className={STATUS[item.status].className}>{STATUS[item.status].label}</Badge></div><p className="mt-3 font-mono text-xs tabular-nums text-muted-foreground">计划 {formatBudgetMoney(item.plannedAmount)} · 支出 {formatBudgetMoney(item.actualSpend)} · 剩余 {formatBudgetMoney(item.remaining)}</p></button>)}</div>
    </>}
    <BudgetItemDrawer item={drawerItem} flows={flows} tasks={tasks} canEdit={canEdit} canManage={canManage} open={Boolean(drawerItem)} onOpenChange={(open) => !open && setDrawerItemId(null)} />
  </section>;
}
