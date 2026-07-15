"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetOverview } from "./BudgetOverview";
import { BudgetPlanningTable } from "./BudgetPlanningTable";
import { BudgetPoolEditor } from "./BudgetPoolEditor";
import { BudgetTransactionTable } from "./BudgetTransactionTable";

type TaskOption = { id: string; name: string };
type BudgetItem = {
  id: string; title: string; category: string | null; plannedAmount: number; actualSpend: number; remaining: number;
  status: "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "SETTLED" | "CANCELED"; description: string | null; source: string;
  aiConfidence: string | null; sourceRef: string | null; createdBy: string; updatedAt: string; taskIds: string[]; taskNames: string[];
};
type Flow = { id: string; budgetItemId: string | null; taskId: string | null; action: string | null; legacyOperation: string; flowType: string; amount: number; counterparty: string | null; description: string; createdBy: string; createdAt: string };
type Planning = { projectId: string; pool: { mode: "PENDING" | "CONFIRMED" | "NOT_MANAGED"; totalBudget: number; confirmedAt: string | null; planned: number; remainingToAllocate: number; actualSpend: number; overPlanned: boolean }; items: BudgetItem[]; flows: Flow[] };

export function BudgetWorkspace({ data, tasks, canEdit, canManage }: { data: Planning; tasks: TaskOption[]; canEdit: boolean; canManage: boolean }) {
  const [view, setView] = useState<"planning" | "flows">("planning");
  const isConfirmed = data.pool.mode === "CONFIRMED";
  const itemTitles = Object.fromEntries(data.items.map((item) => [item.id, item.title]));

  if (!isConfirmed) {
    const notManaged = data.pool.mode === "NOT_MANAGED";
    return <section className="rounded-xl border border-border bg-surface-1 px-5 py-10 text-center"><Landmark className="mx-auto size-7 text-muted-foreground" /><h2 className="mt-3 text-lg font-semibold">{notManaged ? "本项目暂不管理预算" : "项目预算待确认"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{notManaged ? "管控总表和执行日历可继续正常使用。需要时再启用预算管理，不会与 0 元预算混淆。" : "请先确认项目总预算，再建立正式预算项。确认后，预算池会成为全部预算规划的上限。"}</p>{canManage && <div className="mt-5 flex justify-center"><BudgetPoolEditor projectId={data.projectId} mode={data.pool.mode} totalBudget={data.pool.totalBudget} triggerLabel={notManaged ? "启用预算管理" : "确认项目总预算"} /></div>}</section>;
  }

  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">总预算限定预算规划上限，资金动作独立留痕。</p>{canManage && <BudgetPoolEditor projectId={data.projectId} mode={data.pool.mode} totalBudget={data.pool.totalBudget} triggerLabel="管理总预算" />}</div><BudgetOverview totalBudget={data.pool.totalBudget} planned={data.pool.planned} remainingToAllocate={data.pool.remainingToAllocate} actualSpend={data.pool.actualSpend} />
    {data.pool.overPlanned && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">预算项合计超过项目总预算。请调整或取消预算项后再继续确认。</div>}
    <div className="flex items-center gap-5 border-b border-border"><Button type="button" variant="ghost" onClick={() => setView("planning")} className={view === "planning" ? "h-9 rounded-none border-b-2 border-primary px-0 text-primary hover:bg-transparent hover:text-primary" : "h-9 rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"}>预算规划</Button><Button type="button" variant="ghost" onClick={() => setView("flows")} className={view === "flows" ? "h-9 rounded-none border-b-2 border-primary px-0 text-primary hover:bg-transparent hover:text-primary" : "h-9 rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"}>资金流水</Button></div>
    {view === "planning" ? <BudgetPlanningTable projectId={data.projectId} items={data.items} flows={data.flows} tasks={tasks} canEdit={canEdit} canManage={canManage} /> : <BudgetTransactionTable flows={data.flows} itemTitles={itemTitles} />}
  </section>;
}
