import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDollarSign, Landmark, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBudgetMoney } from "./BudgetOverview";

type BudgetFlow = {
  id: string;
  budgetItemId: string | null;
  action: string | null;
  legacyOperation: string;
  flowType: string;
  amount: number;
  counterparty: string | null;
  description: string;
  createdBy: string;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  POOL_CONFIRMED: "确认总预算", POOL_ADJUSTED: "调整总预算", ITEM_CONFIRMED: "确认预算项", ITEM_ADJUSTED: "调整预算项",
  APPROVAL_RECORDED: "报批通过", TRANSFER_RECORDED: "划拨", EXPENSE_RECORDED: "记录支出", REFUND_RECORDED: "记录退款",
  SETTLED: "已验收结算", CANCELED: "取消预算项", REVERSED: "撤回动作", LEGACY_IMPORTED: "历史迁移",
};

function FlowIcon({ action }: { action: string | null }) {
  const className = "size-3.5";
  if (action === "EXPENSE_RECORDED") return <ArrowDownRight className={cn(className, "text-warning")} />;
  if (action === "REFUND_RECORDED") return <RotateCcw className={cn(className, "text-success")} />;
  if (action === "SETTLED") return <CheckCircle2 className={cn(className, "text-success")} />;
  if (action === "TRANSFER_RECORDED") return <ArrowUpRight className={cn(className, "text-info")} />;
  if (action === "POOL_CONFIRMED") return <Landmark className={cn(className, "text-primary")} />;
  return <CircleDollarSign className={cn(className, "text-muted-foreground")} />;
}

export function BudgetTransactionTable({ flows, itemTitles }: { flows: BudgetFlow[]; itemTitles: Record<string, string> }) {
  if (flows.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-surface-1 px-5 py-12 text-center text-sm text-muted-foreground">尚无资金流水。确认预算项后，可记录报批、划拨、支出、退款和验收。</div>;
  }

  return <section className="overflow-hidden rounded-xl border border-border bg-surface-1">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5"><div><h2 className="text-base font-semibold">资金流水</h2><p className="mt-1 text-sm text-muted-foreground">记录事实与审批动作，不改变预算规划的原始口径。</p></div><span className="font-mono text-xs tabular-nums text-muted-foreground">{flows.length} 条记录</span></div>
    <ol className="divide-y divide-border">{flows.map((flow) => {
      const action = flow.action ?? flow.legacyOperation;
      const isRefund = flow.action === "REFUND_RECORDED";
      const isExpense = flow.action === "EXPENSE_RECORDED";
      return <li key={flow.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-primary/[0.035] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <span className="flex size-8 items-center justify-center rounded-full border border-border bg-canvas/35"><FlowIcon action={flow.action} /></span>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-border bg-secondary/35 text-muted-foreground">{ACTION_LABEL[action] ?? action}</Badge><p className="truncate text-sm font-medium">{flow.budgetItemId ? itemTitles[flow.budgetItemId] ?? "已删除预算项" : "项目预算池"}</p></div><p className="mt-1 truncate text-xs text-muted-foreground">{flow.description}{flow.counterparty ? ` · ${flow.counterparty}` : ""}</p><p className="mt-1 text-[11px] text-muted-foreground">{flow.createdBy} · {new Date(flow.createdAt).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })}</p></div>
        <p className={cn("font-mono text-sm font-semibold tabular-nums sm:text-right", isRefund ? "text-success" : isExpense ? "text-foreground" : "text-muted-foreground")}>{isRefund ? "+" : ""}{formatBudgetMoney(flow.amount)}</p>
      </li>;
    })}</ol>
  </section>;
}
