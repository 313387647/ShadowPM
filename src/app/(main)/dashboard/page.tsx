import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleDollarSign, FolderKanban, ListChecks, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalDashboardStats, getLeaderDashboardAttention, getLeaderDashboardCalendar, getProjectsHealth } from "@/actions/dashboard-actions";
import { PortfolioTable } from "@/components/dashboard/PortfolioTable";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { GlobalExecutionCalendar } from "@/components/dashboard/GlobalExecutionCalendar";

type DashboardView = "overview" | "projects" | "budget" | "calendar";

const DASHBOARD_VIEWS: Record<DashboardView, { label: string; description: string }> = {
  overview: { label: "全局概览", description: "用项目、事项和预算三张图表建立全局判断，再进入需介入事项。" },
  projects: { label: "项目看板", description: "查看全部项目的运行阶段、完成度和管理信号。" },
  budget: { label: "预算管理", description: "从正式资金流水查看全局结余、消耗与预算风险。" },
  calendar: { label: "执行日历", description: "按月浏览跨项目、已排期的正式执行节点。" },
};

export default async function DashboardPage({ searchParams }: { searchParams?: { view?: string; month?: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");
  const view = isDashboardView(searchParams?.view) ? searchParams!.view : "overview";

  const [stats, health, attention, calendar] = await Promise.all([
    getGlobalDashboardStats(),
    getProjectsHealth(),
    getLeaderDashboardAttention(),
    getLeaderDashboardCalendar(searchParams?.month),
  ]);
  const urgentTasks = attention.attentionTasks.slice(0, 6);
  const upcomingCalendar = attention.upcomingCalendarEntries.slice(0, 6);
  const budgetWatch = buildBudgetWatch(health).slice(0, 6);
  const activeProjects = health.filter((project) => project.lifecycle === "ACTIVE").length;
  const upcomingProjects = health.filter((project) => project.lifecycle === "UPCOMING").length;
  const archivedProjects = health.filter((project) => project.lifecycle === "COMPLETED").length;
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

      {view === "overview" && <>
        <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<AlertTriangle />} label="需优先处理" value={String(urgentTasks.length)} detail={urgentTasks.length ? "逾期或 7 天内待启动事项" : "当前没有紧急事项"} warning={urgentTasks.length > 0} />
          <Metric icon={<FolderKanban />} label="项目运行状态" value={`${activeProjects} 进行中`} detail={`待启动 ${upcomingProjects} · 已归档 ${archivedProjects}`} border />
          <Metric icon={<CalendarClock />} label="未来 7 天节点" value={String(upcomingCalendar.length)} detail="已排期的正式执行节点" border />
          <Metric icon={<CircleDollarSign />} label="确认预算结余" value={formatWan(stats.totalPool - stats.totalExpense + stats.totalRefund)} detail={`确认预算 ${formatWan(stats.totalPool)}`} warning={stats.totalExpense > stats.totalPool} border />
        </section>
        <OverviewCharts projects={health} stats={stats} />
        <AttentionList tasks={urgentTasks} />
      </>}

      {view === "projects" && <PortfolioTable projects={health} />}

      {view === "budget" && <BudgetManagement projects={health} stats={stats} budgetWatch={budgetWatch} />}

      {view === "calendar" && <GlobalExecutionCalendar {...calendar} />}
    </div>
  );
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

function BudgetManagement({ projects, stats, budgetWatch }: { projects: Awaited<ReturnType<typeof getProjectsHealth>>; stats: Awaited<ReturnType<typeof getGlobalDashboardStats>>; budgetWatch: ReturnType<typeof buildBudgetWatch> }) {
  const balance = stats.totalPool - stats.totalExpense + stats.totalRefund;
  const orderedProjects = [...projects].sort((left, right) => right.budgetUsage - left.budgetUsage || left.balance - right.balance);
  return <div className="space-y-5">
    <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-3">
      <Metric icon={<WalletCards />} label="确认预算" value={formatWan(stats.totalPool)} detail="已进入正式资金账本" />
      <Metric icon={<CircleDollarSign />} label="实际支出" value={formatWan(stats.totalExpense)} detail={`退款 ${formatWan(stats.totalRefund)}`} border />
      <Metric icon={<AlertTriangle />} label="可用结余" value={formatWan(balance)} detail={balance < 0 ? "存在整体超支" : "确认预算减去实际支出"} warning={balance < 0} border />
    </section>
    <BudgetWatch projects={budgetWatch} />
    <section className="overflow-hidden rounded-lg border bg-card"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">项目预算总览</h2><p className="mt-0.5 text-xs text-muted-foreground">按预算使用率排序，点击进入项目资金账本。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">项目 / 负责人</th><th className="px-3 py-2.5 font-medium">确认预算</th><th className="px-3 py-2.5 font-medium">实际支出</th><th className="px-3 py-2.5 font-medium">结余</th><th className="px-3 py-2.5 font-medium">使用率</th></tr></thead><tbody className="divide-y">{orderedProjects.map((project) => <tr key={project.id} className="transition-colors hover:bg-muted/35"><td className="px-4 py-3"><Link href={`/projects/${project.id}?tab=ledger`} className="font-medium hover:text-primary">{project.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{project.ownerName}</p></td><td className="px-3 py-3 font-mono text-xs">{formatWan(project.dynamicTotal)}</td><td className="px-3 py-3 font-mono text-xs">{formatWan(project.consumed)}</td><td className={project.balance < 0 ? "px-3 py-3 font-mono text-xs text-destructive" : "px-3 py-3 font-mono text-xs"}>{formatWan(project.balance)}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={project.budgetUsage >= 90 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"} style={{ width: `${Math.min(project.budgetUsage, 100)}%` }} /></div><span className="text-xs tabular-nums">{project.budgetUsage}%</span></div></td></tr>)}</tbody></table></div></section>
  </div>;
}

function BudgetWatch({ projects }: { projects: ReturnType<typeof buildBudgetWatch> }) {
  return <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><WalletCards className="size-4" />预算关注</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">只显示高消耗或超支项目</p>
          </div>
          <Badge variant={projects.some((item) => item.level === "HIGH") ? "destructive" : "secondary"}>{projects.length} 项</Badge>
        </div>
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">当前没有明显预算异常。</div>
        ) : (
          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {projects.map((item) => (
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
      </section>;
}

function Metric({ icon, label, value, detail, border = false, warning = false }: { icon: React.ReactNode; label: string; value: string; detail: string; border?: boolean; warning?: boolean }) {
  return <div className={`${border ? "border-t sm:border-l sm:border-t-0" : ""} px-4 py-4`}><div className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</div><p className={warning ? "mt-1 text-xl font-semibold tabular-nums text-destructive" : "mt-1 text-xl font-semibold tabular-nums"}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>;
}

function AttentionList({ tasks }: { tasks: Awaited<ReturnType<typeof getLeaderDashboardAttention>>["attentionTasks"] }) {
  return <section className="overflow-hidden rounded-lg border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4" />需要管理者关注</h2><p className="mt-0.5 text-xs text-muted-foreground">逾期或 7 天内仍未启动的正式管控事项</p></div><Badge variant={tasks.length > 0 ? "destructive" : "secondary"}>{tasks.length} 项</Badge></div><div className="divide-y">{tasks.length === 0 ? <Empty text="当前没有需要管理者介入的事项。" /> : tasks.map((task) => <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName} · {task.assignee}</p></div><div className="flex shrink-0 flex-wrap justify-end gap-1">{task.signals.map((signal) => <Badge key={signal} variant={signal === "已逾期" ? "destructive" : "outline"}>{signal}</Badge>)}</div></div></Link>)}</div></section>;
}

function BudgetValue({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div><p className="text-muted-foreground">{label}</p><p className={warning ? "mt-0.5 font-mono text-destructive" : "mt-0.5 font-mono text-foreground"}>{formatWan(value)}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function formatWan(value: number) {
  const absolute = Math.abs(value);
  const label = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${absolute.toLocaleString("zh-CN")}`;
  return value < 0 ? `-${label}` : label;
}

function buildBudgetWatch(projects: Awaited<ReturnType<typeof getProjectsHealth>>) {
  return projects.map((project) => {
    if (project.balance < 0) return { ...project, level: "HIGH" as const, label: "已超支", score: 1100 + Math.abs(project.balance), reason: `确认预算已不足，当前结余 ${formatWan(project.balance)}。` };
    if (project.dynamicTotal > 0 && project.budgetUsage >= 90) return { ...project, level: "HIGH" as const, label: `${project.budgetUsage}%`, score: 900 + project.budgetUsage, reason: "预算消耗接近上限，需要核对后续支出安排。" };
    return null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => b.score - a.score);
}


function isDashboardView(value: string | undefined): value is DashboardView {
  return value === "overview" || value === "projects" || value === "budget" || value === "calendar";
}
