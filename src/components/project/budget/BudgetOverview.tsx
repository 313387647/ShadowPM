import { ArrowDownRight, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatBudgetMoney(amount: number) {
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProgressLine({ label, value, total, tone, detail }: { label: string; value: number; total: number; tone: "primary" | "success"; detail: string }) {
  const percent = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{formatBudgetMoney(value)} <span className="text-muted-foreground">/ {formatBudgetMoney(total)}</span></span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full transition-[width]", tone === "primary" ? "bg-primary" : "bg-success")} style={{ width: `${percent}%` }} />
    </div>
    <p className="text-[11px] text-muted-foreground">{detail}</p>
  </div>;
}

export function BudgetOverview({ totalBudget, planned, remainingToAllocate, actualSpend }: { totalBudget: number; planned: number; remainingToAllocate: number; actualSpend: number }) {
  const overAllocated = remainingToAllocate < 0;

  return <section className="overflow-hidden rounded-xl border border-border bg-surface-1">
    <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,hsl(var(--primary)/0.18),transparent_48%)]" aria-hidden="true" />
        <div className="relative">
          <p className="section-kicker">Project Budget</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{formatBudgetMoney(totalBudget)}</p>
            <span className="mb-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">已确认预算池</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">项目级预算上限。预算项可先规划，资金动作独立留痕。</p>
        </div>
      </div>

      <div className="grid border-t border-border bg-canvas/20 sm:grid-cols-2 lg:border-l lg:border-t-0">
        <div className="px-5 py-5 sm:border-r sm:border-border lg:border-r-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><WalletCards className="size-3.5 text-primary" />可分配余额</div>
          <p className={cn("mt-2 font-mono text-xl font-semibold tabular-nums", overAllocated && "text-destructive")}>{formatBudgetMoney(remainingToAllocate)}</p>
          <p className={cn("mt-1 text-[11px]", overAllocated ? "text-destructive" : "text-muted-foreground")}>{overAllocated ? "预算规划已超出预算池" : "可用于新增或调整预算项"}</p>
        </div>
        <div className="border-t border-border px-5 py-5 sm:border-l-0 sm:border-t-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowDownRight className="size-3.5 text-success" />实际支出</div>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{formatBudgetMoney(actualSpend)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">已扣除退款后的净额</p>
        </div>
      </div>
    </div>
    <div className="grid gap-4 border-t border-border bg-canvas/25 px-5 py-4 sm:grid-cols-2 sm:px-6">
      <ProgressLine label="预算编排" value={planned} total={totalBudget} tone="primary" detail="预算项已占用的规划额度" />
      <ProgressLine label="实际支出" value={actualSpend} total={totalBudget} tone="success" detail="已发生的资金消耗，不等同于预算编排" />
    </div>
  </section>;
}
