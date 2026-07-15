import { redirect } from "next/navigation";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalDashboardStats, getLeaderDashboardAttention, getLeaderDashboardCalendar, getProjectsHealth } from "@/actions/dashboard-actions";
import { PortfolioTable } from "@/components/dashboard/PortfolioTable";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { GlobalExecutionCalendar } from "@/components/dashboard/GlobalExecutionCalendar";

type DashboardView = "overview" | "projects" | "budget" | "calendar";

const DASHBOARD_VIEWS: Record<DashboardView, { label: string; description: string }> = {
  overview: { label: "全局概览", description: "先看需要介入的事实，再判断项目、事项和预算状态。" },
  projects: { label: "项目看板", description: "查看全部项目的运行阶段、完成度和管理信号。" },
  budget: { label: "预算管理", description: "从正式资金流水查看全局结余、消耗与预算风险。" },
  calendar: { label: "执行日历", description: "按月浏览跨项目、已排期的正式执行节点。" },
};

export default async function DashboardPage({ searchParams }: { searchParams?: { view?: string; month?: string; budgetFilter?: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");
  const view = isDashboardView(searchParams?.view) ? searchParams!.view : "overview";

  const viewMeta = DASHBOARD_VIEWS[view];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">管理者全局大盘</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{viewMeta.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{viewMeta.description}</p>
        </div>
        <p className="text-xs text-muted-foreground">更新于 {new Date().toLocaleString("zh-CN")}</p>
      </header>

      <DashboardViewNav activeView={view} />

      {view === "overview" && <OverviewDashboard />}
      {view === "projects" && <ProjectsDashboard />}
      {view === "budget" && <BudgetDashboard filter={searchParams?.budgetFilter} />}
      {view === "calendar" && <CalendarDashboard month={searchParams?.month} />}
    </div>
  );
}

async function OverviewDashboard() {
  const [stats, health, attention] = await Promise.all([getGlobalDashboardStats(), getProjectsHealth(), getLeaderDashboardAttention()]);
  const urgentTasks = attention.attentionTasks.slice(0, 6);
  const upcomingCalendar = attention.upcomingCalendarEntries.slice(0, 6);
  const activeProjects = health.filter((project) => project.lifecycle === "ACTIVE").length;

  return <>
    <section className="flex flex-wrap divide-x divide-border border-y border-border text-sm" aria-label="全局核心状态">
      <SummaryMetric label="进行中项目" value={String(activeProjects)} />
      <SummaryMetric label="未来 7 天节点" value={String(upcomingCalendar.length)} />
      <SummaryMetric label="可用预算" value={formatWan(stats.totalPool - stats.totalExpense)} warning={stats.totalExpense > stats.totalPool} />
    </section>
    <AttentionList tasks={urgentTasks} />
    <OverviewCharts projects={health} stats={stats} />
  </>;
}

async function ProjectsDashboard() {
  return <PortfolioTable projects={await getProjectsHealth()} />;
}

async function BudgetDashboard({ filter }: { filter?: string }) {
  const [stats, health] = await Promise.all([getGlobalDashboardStats(), getProjectsHealth()]);
  return <BudgetManagement projects={health} stats={stats} filter={filter} />;
}

async function CalendarDashboard({ month }: { month?: string }) {
  return <GlobalExecutionCalendar {...await getLeaderDashboardCalendar(month)} />;
}

function DashboardViewNav({ activeView }: { activeView: DashboardView }) {
  const items: Array<{ view: DashboardView; label: string }> = [
    { view: "overview", label: "概览" },
    { view: "projects", label: "项目看板" },
    { view: "budget", label: "预算管理" },
    { view: "calendar", label: "执行日历" },
  ];
  return <nav className="flex overflow-x-auto rounded-lg border bg-card p-1" aria-label="全局大盘分栏">{items.map((item) => <Link key={item.view} href={item.view === "overview" ? "/dashboard" : `/dashboard?view=${item.view}`} className={item.view === activeView ? "shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" : "shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}>{item.label}</Link>)}</nav>;
}

type BudgetFilter = "all" | "anomaly" | "high" | "over";

function BudgetManagement({ projects, stats, filter }: { projects: Awaited<ReturnType<typeof getProjectsHealth>>; stats: Awaited<ReturnType<typeof getGlobalDashboardStats>>; filter?: string }) {
  const balance = stats.totalPool - stats.totalExpense;
  const activeFilter: BudgetFilter = filter === "anomaly" || filter === "high" || filter === "over" ? filter : "all";
  const orderedProjects = projects
    .filter((project) => activeFilter === "all" || (activeFilter === "over" && project.balance < 0) || (activeFilter === "high" && project.budgetUsage >= 90) || (activeFilter === "anomaly" && (project.balance < 0 || project.budgetUsage >= 90)))
    .sort((left, right) => Number(right.balance < 0) - Number(left.balance < 0) || right.budgetUsage - left.budgetUsage || left.balance - right.balance);
  return <div className="space-y-5">
    <section className="flex flex-wrap divide-x divide-border border-y border-border text-sm">
      <SummaryMetric label="确认预算" value={formatWan(stats.totalPool)} />
      <SummaryMetric label="实际支出" value={formatWan(stats.totalExpense)} />
      <SummaryMetric label="可用结余" value={formatWan(balance)} warning={balance < 0} />
    </section>
    <section className="overflow-hidden rounded-lg border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h2 className="text-sm font-semibold">项目预算</h2><nav className="flex flex-wrap gap-1" aria-label="项目预算筛选">{([['all', '全部'], ['anomaly', '只看异常'], ['high', '高消耗'], ['over', '已超支']] as const).map(([value, label]) => <Link key={value} href={value === 'all' ? '/dashboard?view=budget' : `/dashboard?view=budget&budgetFilter=${value}`} className={activeFilter === value ? 'rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground' : 'rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'}>{label}</Link>)}</nav></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">项目 / 负责人</th><th className="px-3 py-2.5 font-medium">确认预算</th><th className="px-3 py-2.5 font-medium">实际支出</th><th className="px-3 py-2.5 font-medium">结余</th><th className="px-3 py-2.5 font-medium">使用率</th></tr></thead><tbody className="divide-y">{orderedProjects.map((project) => <tr key={project.id} className="transition-colors hover:bg-muted/35"><td className="px-4 py-3"><Link href={`/projects/${project.id}?tab=ledger`} className="font-medium hover:text-primary">{project.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{project.ownerName}</p></td><td className="px-3 py-3 font-mono text-xs">{formatWan(project.dynamicTotal)}</td><td className="px-3 py-3 font-mono text-xs">{formatWan(project.consumed)}</td><td className={project.balance < 0 ? "px-3 py-3 font-mono text-xs text-destructive" : "px-3 py-3 font-mono text-xs"}>{formatWan(project.balance)}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={project.budgetUsage >= 90 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"} style={{ width: `${Math.min(project.budgetUsage, 100)}%` }} /></div><span className="text-xs tabular-nums">{project.budgetUsage}%</span></div></td></tr>)}</tbody></table></div></section>
  </div>;
}

function AttentionList({ tasks }: { tasks: Awaited<ReturnType<typeof getLeaderDashboardAttention>>["attentionTasks"] }) {
  return <section className="overflow-hidden rounded-lg border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4" />需要管理者关注</h2><p className="mt-0.5 text-xs text-muted-foreground">逾期或 7 天内仍未启动的正式管控事项</p></div><Badge variant={tasks.length > 0 ? "destructive" : "secondary"}>{tasks.length} 项</Badge></div><div className="divide-y">{tasks.length === 0 ? <Empty text="当前没有需要管理者介入的事项。" /> : tasks.map((task) => <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName} · {task.assignee}</p></div><div className="flex shrink-0 flex-wrap justify-end gap-1">{task.signals.map((signal) => <Badge key={signal} variant={signal === "已逾期" ? "destructive" : "outline"}>{signal}</Badge>)}</div></div></Link>)}</div></section>;
}

function SummaryMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="min-w-[150px] flex-1 px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className={warning ? "mt-1 font-medium tabular-nums text-destructive" : "mt-1 font-medium tabular-nums"}>{value}</p></div>; }

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function formatWan(value: number) {
  const absolute = Math.abs(value);
  const label = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${absolute.toLocaleString("zh-CN")}`;
  return value < 0 ? `-${label}` : label;
}

function isDashboardView(value: string | undefined): value is DashboardView {
  return value === "overview" || value === "projects" || value === "budget" || value === "calendar";
}
