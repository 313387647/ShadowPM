import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarClock, FolderKanban, ListChecks, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalDashboardStats, getLeaderDashboardAttention, getProjectsHealth } from "@/actions/dashboard-actions";
import { generateDashboardSummary } from "@/actions/dashboard-ai";
import { AISummaryCard } from "@/components/dashboard/AISummaryCard";
import { PortfolioTable } from "@/components/dashboard/PortfolioTable";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");

  const [stats, health, summary, attention] = await Promise.all([
    getGlobalDashboardStats(),
    getProjectsHealth(),
    generateDashboardSummary(),
    getLeaderDashboardAttention(),
  ]);
  const urgentTasks = attention.attentionTasks.slice(0, 6);
  const upcomingCalendar = attention.upcomingCalendarEntries.slice(0, 6);
  const budgetWatch = buildBudgetWatch(health).slice(0, 6);
  const totalItems = stats.taskByStatus.PENDING + stats.taskByStatus.IN_PROGRESS + stats.taskByStatus.COMPLETED;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">管理驾驶舱</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">今天需要关注什么？</h1>
          <p className="mt-1 text-sm text-muted-foreground">{stats.projectCount} 个项目 · {totalItems} 项管控事项 · 数据来自正式管控表、账本和日历</p>
        </div>
        <p className="text-xs text-muted-foreground">更新于 {new Date().toLocaleString("zh-CN")}</p>
      </header>

      <AISummaryCard summary={summary} />

      <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<FolderKanban />} label="活跃项目" value={String(stats.activeProjectCount)} detail={`共 ${stats.projectCount} 个项目`} />
        <Metric icon={<AlertTriangle />} label="逾期事项" value={String(stats.overdueTaskCount)} detail={`待启动 ${stats.taskByStatus.PENDING} · 进行中 ${stats.taskByStatus.IN_PROGRESS}`} warning={stats.overdueTaskCount > 0} border />
        <Metric icon={<TrendingUp />} label="确认预算池" value={formatWan(stats.totalPool)} detail="来自正式预算流水" border />
        <Metric icon={<TrendingDown />} label="总支出" value={formatWan(stats.totalExpense)} detail={`退款 ${formatWan(stats.totalRefund)}`} warning={stats.totalExpense > stats.totalPool && stats.totalPool > 0} border />
      </section>

      <PortfolioTable projects={health} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <AttentionList tasks={urgentTasks} />
        <CalendarList entries={upcomingCalendar} />
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><WalletCards className="size-4" />预算关注</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">只显示未确认、先支出、高消耗或超支项目</p>
          </div>
          <Badge variant={budgetWatch.some((item) => item.level === "HIGH") ? "destructive" : "secondary"}>{budgetWatch.length} 项</Badge>
        </div>
        {budgetWatch.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">当前没有明显预算异常。</div>
        ) : (
          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {budgetWatch.map((item) => (
              <Link key={item.id} href={`/projects/${item.id}?tab=ledger`} className="block p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.ownerName}</p></div>
                  <Badge variant={item.level === "HIGH" ? "destructive" : "outline"}>{item.label}</Badge>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <BudgetValue label="计划" value={item.plannedBudget} />
                  <BudgetValue label="确认" value={item.dynamicTotal} />
                  <BudgetValue label="结余" value={item.balance} warning={item.balance < 0} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail, border = false, warning = false }: { icon: React.ReactNode; label: string; value: string; detail: string; border?: boolean; warning?: boolean }) {
  return <div className={`${border ? "border-t sm:border-l sm:border-t-0" : ""} px-4 py-4`}><div className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</div><p className={warning ? "mt-1 text-xl font-semibold tabular-nums text-destructive" : "mt-1 text-xl font-semibold tabular-nums"}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>;
}

function AttentionList({ tasks }: { tasks: Awaited<ReturnType<typeof getLeaderDashboardAttention>>["attentionTasks"] }) {
  return <section className="overflow-hidden rounded-lg border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4" />今日优先关注</h2><p className="mt-0.5 text-xs text-muted-foreground">逾期、缺字段或临近未启动事项</p></div><Badge variant={tasks.length > 0 ? "destructive" : "secondary"}>{tasks.length} 项</Badge></div><div className="divide-y">{tasks.length === 0 ? <Empty text="当前没有需要立刻处理的管控事项。" /> : tasks.map((task) => <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName} · {task.assignee ?? "负责人待确认"}</p></div><div className="flex shrink-0 flex-wrap justify-end gap-1">{task.signals.map((signal) => <Badge key={signal} variant={signal === "已逾期" ? "destructive" : "outline"}>{signal}</Badge>)}</div></div></Link>)}</div></section>;
}

function CalendarList({ entries }: { entries: Awaited<ReturnType<typeof getLeaderDashboardAttention>>["upcomingCalendarEntries"] }) {
  return <section className="overflow-hidden rounded-lg border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4" />近期执行日历</h2><p className="mt-0.5 text-xs text-muted-foreground">未来 7 天及日期待确认节点</p></div><Badge variant="outline">{entries.length} 条</Badge></div><div className="divide-y">{entries.length === 0 ? <Empty text="未来 7 天暂无执行节点。" /> : entries.map((entry) => <Link key={entry.id} href={`/projects/${entry.projectId}?tab=calendar${entry.taskId ? `&calendarTask=${entry.taskId}` : ""}`} className="block px-4 py-3 transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.content}</p><p className="mt-1 truncate text-xs text-muted-foreground">{entry.projectName} · {entry.channel ?? "渠道待确认"} · {entry.owner ?? "负责人待确认"}</p></div><Badge variant={entry.isUnscheduled ? "destructive" : "secondary"}>{entry.isUnscheduled ? "待排期" : formatDate(entry.date)}</Badge></div></Link>)}</div></section>;
}

function BudgetValue({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div><p className="text-muted-foreground">{label}</p><p className={warning ? "mt-0.5 font-mono text-destructive" : "mt-0.5 font-mono text-foreground"}>{formatWan(value)}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function formatDate(value: Date | string | null) {
  if (!value) return "待确认";
  return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatWan(value: number) {
  const absolute = Math.abs(value);
  const label = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${absolute.toLocaleString("zh-CN")}`;
  return value < 0 ? `-${label}` : label;
}

function buildBudgetWatch(projects: Awaited<ReturnType<typeof getProjectsHealth>>) {
  return projects.map((project) => {
    if (project.dynamicTotal === 0 && project.consumed > 0) return { ...project, level: "HIGH" as const, label: "先支出", score: 1200 + project.consumed, reason: "存在已支出金额，但项目尚无确认预算池。" };
    if (project.balance < 0) return { ...project, level: "HIGH" as const, label: "已超支", score: 1100 + Math.abs(project.balance), reason: `确认预算已不足，当前结余 ${formatWan(project.balance)}。` };
    if (project.dynamicTotal > 0 && project.budgetUsage >= 90) return { ...project, level: "HIGH" as const, label: `${project.budgetUsage}%`, score: 900 + project.budgetUsage, reason: "预算消耗接近上限，需要核对后续支出安排。" };
    if (project.plannedBudget > 0 && project.dynamicTotal === 0) return { ...project, level: "MEDIUM" as const, label: "未确认", score: 700 + project.plannedBudget / 10000, reason: "项目有计划预算，但尚未进入正式资金账本。" };
    return null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => b.score - a.score);
}
