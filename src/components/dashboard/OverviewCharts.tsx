import type { getGlobalDashboardStats, getProjectsHealth } from "@/actions/dashboard-actions";

type HealthProject = Awaited<ReturnType<typeof getProjectsHealth>>[number];
type DashboardStats = Awaited<ReturnType<typeof getGlobalDashboardStats>>;

export function OverviewCharts({ projects, stats }: { projects: HealthProject[]; stats: DashboardStats }) {
  const atRisk = projects.filter((project) => project.isAtRisk).length;
  const healthy = projects.filter((project) => project.lifecycle === "ACTIVE" && !project.isAtRisk).length;
  const watch = projects.filter((project) => project.lifecycle === "UPCOMING" && !project.isAtRisk).length;
  const netExpense = Math.max(stats.totalExpense - stats.totalRefund, 0);
  const budgetBalance = Math.max(stats.totalPool - netExpense, 0);
  const totalTasks = stats.taskByStatus.PENDING + stats.taskByStatus.IN_PROGRESS + stats.taskByStatus.COMPLETED;

  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="管理状态摘要">
      <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">管理状态摘要</h2><p className="mt-0.5 text-xs text-muted-foreground">用项目、事项和预算的关键状态辅助判断，不重复展示普通成员待办。</p></div>
      <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <SummaryBlock title="项目健康" total={projects.length} unit="个项目" segments={[{ label: "需关注", value: atRisk, tone: "danger" }, { label: "稳定推进", value: healthy, tone: "primary" }, { label: "待启动", value: watch, tone: "warning" }]} />
        <SummaryBlock title="事项进度" total={totalTasks} unit="个事项" segments={[{ label: "待启动", value: stats.taskByStatus.PENDING, tone: "warning" }, { label: "进行中", value: stats.taskByStatus.IN_PROGRESS, tone: "primary" }, { label: "已完成", value: stats.taskByStatus.COMPLETED, tone: "success" }]} />
        <SummaryBlock title="预算执行" total={stats.totalPool} unit="确认预算" formatter={formatWan} segments={[{ label: "已编排", value: stats.totalAllocated, tone: "primary" }, { label: "已支出", value: netExpense, tone: "warning" }, { label: "可用结余", value: budgetBalance, tone: "success" }]} />
      </div>
    </section>
  );
}

function SummaryBlock({ title, total, unit, segments, formatter = String }: { title: string; total: number; unit: string; segments: Array<{ label: string; value: number; tone: "primary" | "success" | "warning" | "danger" }>; formatter?: (value: number) => string }) {
  return <div className="p-4"><div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-medium">{title}</h3><p className="text-xs text-muted-foreground">{formatter(total)} {unit}</p></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">{segments.map((segment) => <span key={segment.label} className={`inline-block h-full ${toneClass(segment.tone)}`} style={{ width: `${total > 0 ? Math.min((Math.max(segment.value, 0) / total) * 100, 100) : 0}%` }} />)}</div><div className="mt-3 space-y-2">{segments.map((segment) => <div key={segment.label} className="flex items-center gap-2 text-xs"><span className={`size-1.5 rounded-full ${toneClass(segment.tone)}`} /><span className="flex-1 text-muted-foreground">{segment.label}</span><span className="tabular-nums">{formatter(segment.value)}</span></div>)}</div></div>;
}

function toneClass(tone: "primary" | "success" | "warning" | "danger") { return tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-destructive" : "bg-primary"; }
function formatWan(value: number) { const absolute = Math.abs(value); const amount = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${Math.round(absolute).toLocaleString("zh-CN")}`; return value < 0 ? `-${amount}` : amount; }
