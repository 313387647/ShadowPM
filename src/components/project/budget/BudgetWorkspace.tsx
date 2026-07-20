"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"planning" | "flows">(searchParams.get("budgetView") === "flows" ? "flows" : "planning");
  const isConfirmed = data.pool.mode === "CONFIRMED";
  const itemTitles = Object.fromEntries(data.items.map((item) => [item.id, item.title]));

  useEffect(() => setView(searchParams.get("budgetView") === "flows" ? "flows" : "planning"), [searchParams]);

  function selectView(nextView: "planning" | "flows") {
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "planning") params.delete("budgetView"); else params.set("budgetView", nextView);
    router.replace(`/projects/${data.projectId}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  if (!isConfirmed) {
    const notManaged = data.pool.mode === "NOT_MANAGED";
    return <section className="border-y border-border px-5 py-12 text-center"><Landmark className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-base font-semibold">{notManaged ? "本项目未启用预算管理" : "项目预算待确认"}</h2><p className="mt-1 text-sm text-muted-foreground">{notManaged ? "需要时可直接启用预算管理。" : "确认总预算后，即可添加预算项并记录资金动作。"}</p>{canManage && <div className="mt-5 flex justify-center"><BudgetPoolEditor projectId={data.projectId} mode={data.pool.mode} totalBudget={data.pool.totalBudget} triggerLabel={notManaged ? "启用预算管理" : "确认总预算"} /></div>}</section>;
  }

  return <section className="space-y-4"><div className="flex items-center justify-end">{canManage && <BudgetPoolEditor projectId={data.projectId} mode={data.pool.mode} totalBudget={data.pool.totalBudget} triggerLabel="管理总预算" />}</div><BudgetOverview totalBudget={data.pool.totalBudget} planned={data.pool.planned} remainingToAllocate={data.pool.remainingToAllocate} actualSpend={data.pool.actualSpend} />
    {data.pool.overPlanned && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">预算项合计超过项目总预算。请调整或取消预算项后再继续确认。</div>}
    <div className="flex items-center gap-5 border-b border-border"><Button type="button" variant="ghost" onClick={() => selectView("planning")} className={view === "planning" ? "h-9 rounded-none border-b-2 border-primary px-0 text-primary hover:bg-transparent hover:text-primary" : "h-9 rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"}>预算规划</Button><Button type="button" variant="ghost" onClick={() => selectView("flows")} className={view === "flows" ? "h-9 rounded-none border-b-2 border-primary px-0 text-primary hover:bg-transparent hover:text-primary" : "h-9 rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"}>资金流水</Button></div>
    {view === "planning" ? <BudgetPlanningTable projectId={data.projectId} items={data.items} flows={data.flows} tasks={tasks} canEdit={canEdit} canManage={canManage} /> : <BudgetTransactionTable flows={data.flows} itemTitles={itemTitles} />}
  </section>;
}
