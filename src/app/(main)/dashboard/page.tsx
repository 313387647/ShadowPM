import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, FolderKanban, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalDashboardStats, getProjectsHealth } from "@/actions/dashboard-actions";
import { generateDashboardSummary } from "@/actions/dashboard-ai";
import { BarBudgetChart } from "@/components/dashboard/BarBudgetChart";
import { DonutStatusChart } from "@/components/dashboard/DonutStatusChart";
import { AISummaryCard } from "@/components/dashboard/AISummaryCard";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");

  const [stats, health, aiSummary] = await Promise.all([
    getGlobalDashboardStats(),
    getProjectsHealth(),
    generateDashboardSummary(),
  ]);

  const atRiskProjects = health.filter((p) => p.isAtRisk);

  return (
    <div className="p-6 space-y-6">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📊 全局大盘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          团队 {stats.projectCount} 个项目 · {stats.taskByStatus.PENDING + stats.taskByStatus.IN_PROGRESS + stats.taskByStatus.COMPLETED} 个任务
        </p>
      </div>

      {/* 🤖 AI 摘要 */}
      <AISummaryCard summary={aiSummary} />

      {/* ── 4 个统计卡片 ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" />
              确认预算池
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              ¥{Math.round(stats.totalPool / 10000).toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">万</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              来自 ALLOCATE 流水
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="size-4" />
              总支出
            </div>
            <p className="mt-1 text-2xl font-bold text-red-500 tabular-nums">
              ¥{Math.round(stats.totalExpense / 10000).toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">万</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              退款 ¥{Math.round(stats.totalRefund / 10000).toLocaleString()} 万
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderKanban className="size-4" />
              活跃项目
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {stats.activeProjectCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              共 {stats.projectCount} 个项目
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" />
              逾期任务
            </div>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                stats.overdueTaskCount > 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {stats.overdueTaskCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              待启动 {stats.taskByStatus.PENDING} / 进行中 {stats.taskByStatus.IN_PROGRESS} / 已完成 {stats.taskByStatus.COMPLETED}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 双图表 ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarBudgetChart data={health} />
        <DonutStatusChart
          pending={stats.taskByStatus.PENDING}
          inProgress={stats.taskByStatus.IN_PROGRESS}
          completed={stats.taskByStatus.COMPLETED}
        />
      </div>

      {/* ── 风险预警列表 ── */}
      {atRiskProjects.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-destructive" />
            风险预警
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
              {atRiskProjects.length}
            </Badge>
          </h3>
          <div className="divide-y divide-destructive/10">
            {atRiskProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 -mx-3 rounded-md transition-colors hover:bg-destructive/10"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({p.ownerName})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  {p.budgetUsage > 90 && (
                    <span className="text-destructive font-medium">
                      预算消耗 {p.budgetUsage}%
                    </span>
                  )}
                  {p.hasOverdueTasks && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-destructive/30 text-destructive">
                      含逾期任务
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    进度 {p.taskProgress}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
