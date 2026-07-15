import type { getGlobalDashboardStats, getProjectsHealth } from "@/actions/dashboard-actions";

type HealthProject = Awaited<ReturnType<typeof getProjectsHealth>>[number];
type DashboardStats = Awaited<ReturnType<typeof getGlobalDashboardStats>>;

export function OverviewCharts({ projects, stats }: { projects: HealthProject[]; stats: DashboardStats }) {
  const atRisk = projects.filter((project) => project.isAtRisk).length;
  const healthy = projects.filter((project) => project.lifecycle === "ACTIVE" && !project.isAtRisk).length;
  const watch = projects.filter((project) => project.lifecycle === "UPCOMING" && !project.isAtRisk).length;
  const netExpense = Math.max(stats.totalExpense - stats.totalRefund, 0);

  const allocatedRate = stats.totalPool > 0 ? Math.round((stats.totalAllocated / stats.totalPool) * 100) : 0;
  const expenseRate = stats.totalPool > 0 ? Math.round((netExpense / stats.totalPool) * 100) : 0;
  return <section className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border px-4 py-3 text-sm" aria-label="管理状态摘要"><p><span className="mr-2 text-xs text-muted-foreground">项目</span>健康 {healthy} · 预警 {watch} · 风险 {atRisk}</p><p><span className="mr-2 text-xs text-muted-foreground">事项</span>待启动 {stats.taskByStatus.PENDING} · 进行中 {stats.taskByStatus.IN_PROGRESS} · 已完成 {stats.taskByStatus.COMPLETED}</p><p><span className="mr-2 text-xs text-muted-foreground">预算</span>已编排 {allocatedRate}% · 已支出 {expenseRate}%</p></section>;
}
