import { cn } from "@/lib/utils";

export function formatBudgetMoney(amount: number) { return `¥${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`; }

export function BudgetOverview({ totalBudget, planned, remainingToAllocate, actualSpend }: { totalBudget: number; planned: number; remainingToAllocate: number; actualSpend: number }) {
  const overAllocated = remainingToAllocate < 0;
  return <section className="border-y border-border py-4"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="text-sm text-muted-foreground">总预算</p><p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{formatBudgetMoney(totalBudget)}</p></div><p className="mt-2 text-sm text-muted-foreground">已编排 <span className="font-mono text-foreground tabular-nums">{formatBudgetMoney(planned)}</span> · 实际支出 <span className="font-mono text-foreground tabular-nums">{formatBudgetMoney(actualSpend)}</span> · <span className={overAllocated ? "text-destructive" : "text-muted-foreground"}>剩余 <span className="font-mono tabular-nums">{formatBudgetMoney(remainingToAllocate)}</span></span></p><div className="mt-4 grid gap-3 sm:grid-cols-2"><ProgressLine label="预算编排" value={planned} total={totalBudget} tone="primary" /><ProgressLine label="实际支出" value={actualSpend} total={totalBudget} tone="success" /></div></section>;
}

function ProgressLine({ label, value, total, tone }: { label: string; value: number; total: number; tone: "primary" | "success" }) { const percent = total > 0 ? Math.min((value / total) * 100, 100) : 0; return <div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono tabular-nums">{Math.round(percent)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-success")} style={{ width: `${percent}%` }} /></div></div>; }
