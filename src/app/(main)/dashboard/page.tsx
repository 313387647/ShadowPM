import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalDashboardStats, getLeaderDashboardAttention, getLeaderDashboardCalendar, getProjectsHealth } from "@/actions/dashboard-actions";
import { PortfolioTable } from "@/components/dashboard/PortfolioTable";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { GlobalExecutionCalendar } from "@/components/dashboard/GlobalExecutionCalendar";

type DashboardView = "overview" | "projects" | "budget" | "calendar";

export default async function DashboardPage({ searchParams }: { searchParams?: { view?: string; month?: string; budgetFilter?: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");
  const view = isDashboardView(searchParams?.view) ? searchParams!.view : "overview";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-7">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">管理总览</h1>
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

  return <div className="space-y-6">
    <section className="flex flex-wrap divide-x divide-border border-y border-border text-sm" aria-label="全局核心状态">
      <SummaryMetric label="进行中项目" value={String(activeProjects)} />
      <SummaryMetric label="未来 7 天节点" value={String(upcomingCalendar.length)} />
      <SummaryMetric label="可用预算" value={formatWan(stats.totalPool - stats.totalExpense)} warning={stats.totalExpense > stats.totalPool} />
    </section>
    <AttentionList tasks={urgentTasks} />
    <OverviewCharts projects={health} stats={stats} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
      <PortfolioSnapshot projects={health.slice(0, 6)} />
      <UpcomingAgenda entries={upcomingCalendar} />
    </div>
  </div>;
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
  return <nav className="flex gap-5 overflow-x-auto border-b border-border" aria-label="管理总览分栏">{items.map((item) => <Link key={item.view} href={item.view === "overview" ? "/dashboard" : `/dashboard?view=${item.view}`} className={item.view === activeView ? "shrink-0 border-b-2 border-primary px-0.5 py-2.5 text-sm font-medium text-foreground" : "shrink-0 border-b-2 border-transparent px-0.5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"}>{item.label}</Link>)}</nav>;
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
    <section className="table-shell overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h2 className="text-sm font-semibold">项目预算</h2><nav className="flex flex-wrap gap-1" aria-label="项目预算筛选">{([['all', '全部'], ['anomaly', '只看异常'], ['high', '高消耗'], ['over', '已超支']] as const).map(([value, label]) => <Link key={value} href={value === 'all' ? '/dashboard?view=budget' : `/dashboard?view=budget&budgetFilter=${value}`} className={activeFilter === value ? 'rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground' : 'rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'}>{label}</Link>)}</nav></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">项目 / 负责人</th><th className="px-3 py-2.5 font-medium">确认预算</th><th className="px-3 py-2.5 font-medium">实际支出</th><th className="px-3 py-2.5 font-medium">结余</th><th className="px-3 py-2.5 font-medium">使用率</th></tr></thead><tbody className="divide-y">{orderedProjects.map((project) => <tr key={project.id} className="transition-colors hover:bg-muted/35"><td className="px-4 py-3"><Link href={`/projects/${project.id}?tab=ledger`} className="font-medium hover:text-primary">{project.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{project.ownerName}</p></td><td className="px-3 py-3 font-mono text-xs">{formatWan(project.dynamicTotal)}</td><td className="px-3 py-3 font-mono text-xs">{formatWan(project.consumed)}</td><td className={project.balance < 0 ? "px-3 py-3 font-mono text-xs text-destructive" : "px-3 py-3 font-mono text-xs"}>{formatWan(project.balance)}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={project.budgetUsage >= 90 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"} style={{ width: `${Math.min(project.budgetUsage, 100)}%` }} /></div><span className="text-xs tabular-nums">{project.budgetUsage}%</span></div></td></tr>)}</tbody></table></div></section>
  </div>;
}

function AttentionList({ tasks }: { tasks: Awaited<ReturnType<typeof getLeaderDashboardAttention>>["attentionTasks"] }) {
  return <section className="border-y border-border"><div className="flex items-center justify-between px-0 py-3"><h2 className="text-sm font-semibold">需要介入</h2></div><div className="divide-y divide-border">{tasks.length === 0 ? <Empty text="当前没有需要管理者介入的事项。" /> : tasks.map((task) => <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="flex items-start justify-between gap-3 py-3 transition-colors hover:text-primary"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName} · {task.assignee}</p></div><p className={task.signals.includes("已逾期") ? "shrink-0 text-xs font-medium text-destructive" : "shrink-0 text-xs text-warning"}>{task.signals[0]}</p></Link>)}</div></section>;
}

function PortfolioSnapshot({ projects }: { projects: Awaited<ReturnType<typeof getProjectsHealth>> }) {
  return <section className="border-y border-border"><div className="flex items-center justify-between py-3"><h2 className="text-sm font-semibold">项目组合</h2><Link href="/dashboard?view=projects" className="text-xs font-medium text-primary hover:text-primary/80">查看全部</Link></div><div className="divide-y divide-border">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 transition-colors hover:text-primary"><div className="min-w-0"><p className="truncate text-sm font-medium">{project.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{project.ownerName} · {project.nextNode?.content ?? "未安排下一节点"}</p></div><div className="text-right text-xs text-muted-foreground">{project.overdueCount > 0 ? <span className="font-medium text-destructive">逾期 {project.overdueCount}</span> : <span>{project.budgetUsage}% 已用</span>}</div></Link>)}</div></section>;
}

function UpcomingAgenda({ entries }: { entries: Awaited<ReturnType<typeof getLeaderDashboardAttention>>["upcomingCalendarEntries"] }) {
  return <section className="border-y border-border"><div className="flex items-center justify-between py-3"><h2 className="text-sm font-semibold">未来 7 天</h2><Link href="/dashboard?view=calendar" className="text-xs font-medium text-primary hover:text-primary/80">查看日历</Link></div><div className="divide-y divide-border">{entries.length === 0 ? <Empty text="未来 7 天暂无正式节点。" /> : entries.map((entry) => <Link key={entry.id} href={`/projects/${entry.projectId}?tab=calendar`} className="flex gap-3 py-3 transition-colors hover:text-primary"><p className="w-12 shrink-0 text-xs text-muted-foreground">{formatDay(entry.date)}<br />{entry.startTime ?? "待定"}</p><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.content}</p><p className="mt-1 truncate text-xs text-muted-foreground">{entry.projectName}{entry.owner ? ` · ${entry.owner}` : ""}</p></div></Link>)}</div></section>;
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

function formatDay(value: Date | null) {
  if (!value) return "待定";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function isDashboardView(value: string | undefined): value is DashboardView {
  return value === "overview" || value === "projects" || value === "budget" || value === "calendar";
}
