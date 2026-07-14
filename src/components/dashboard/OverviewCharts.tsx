import type { getGlobalDashboardStats, getProjectsHealth } from "@/actions/dashboard-actions";

type HealthProject = Awaited<ReturnType<typeof getProjectsHealth>>[number];
type DashboardStats = Awaited<ReturnType<typeof getGlobalDashboardStats>>;

export function OverviewCharts({ projects, stats }: { projects: HealthProject[]; stats: DashboardStats }) {
  const atRisk = projects.filter((project) => project.isAtRisk).length;
  const active = projects.filter((project) => project.lifecycle === "ACTIVE" && !project.isAtRisk).length;
  const upcoming = projects.filter((project) => project.lifecycle === "UPCOMING" && !project.isAtRisk).length;
  const archived = projects.filter((project) => project.lifecycle === "COMPLETED" && !project.isAtRisk).length;
  const netExpense = Math.max(stats.totalExpense - stats.totalRefund, 0);
  const budgetBalance = Math.max(stats.totalPool - netExpense, 0);

  return <section className="grid gap-4 lg:grid-cols-3">
    <DonutPanel title="项目健康分布" caption="风险项目优先覆盖其运行阶段" total={projects.length} centerLabel="项目" segments={[
      { label: "需关注", value: atRisk, color: "hsl(var(--destructive))" },
      { label: "稳定推进", value: active, color: "hsl(var(--primary))" },
      { label: "待启动", value: upcoming, color: "hsl(var(--warning))" },
      { label: "已归档", value: archived, color: "hsl(var(--muted-foreground))" },
    ]} />
    <DonutPanel title="管控事项进度" caption="正式管控表中的事项状态" total={stats.taskByStatus.PENDING + stats.taskByStatus.IN_PROGRESS + stats.taskByStatus.COMPLETED} centerLabel="事项" segments={[
      { label: "待启动", value: stats.taskByStatus.PENDING, color: "hsl(var(--warning))" },
      { label: "进行中", value: stats.taskByStatus.IN_PROGRESS, color: "hsl(var(--primary))" },
      { label: "已完成", value: stats.taskByStatus.COMPLETED, color: "hsl(var(--success))" },
    ]} />
    <DonutPanel title="确认预算消耗" caption="确认预算池扣除退款后的实际消耗" total={stats.totalPool} centerLabel="预算" formatValue={formatWan} segments={[
      { label: "已消耗", value: netExpense, color: "hsl(var(--primary))" },
      { label: "可用结余", value: budgetBalance, color: "hsl(var(--success))" },
    ]} />
  </section>;
}

function DonutPanel({ title, caption, total, centerLabel, segments, formatValue = String }: { title: string; caption: string; total: number; centerLabel: string; segments: Array<{ label: string; value: number; color: string }>; formatValue?: (value: number) => string }) {
  const normalized = segments.map((segment) => ({ ...segment, value: Math.max(segment.value, 0) }));
  const segmentTotal = normalized.reduce((sum, segment) => sum + segment.value, 0);
  let position = 0;
  const stops = normalized.map((segment) => {
    const start = segmentTotal > 0 ? (position / segmentTotal) * 100 : 0;
    position += segment.value;
    const end = segmentTotal > 0 ? (position / segmentTotal) * 100 : 0;
    return `${segment.color} ${start}% ${end}%`;
  });
  const background = segmentTotal > 0 ? `conic-gradient(${stops.join(", ")})` : "hsl(var(--muted))";
  return <section className="overflow-hidden rounded-lg border bg-card"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{caption}</p></div><div className="flex items-center gap-4 p-4"><div className="flex size-28 shrink-0 items-center justify-center rounded-full p-2" style={{ background }}><div className="flex size-full flex-col items-center justify-center rounded-full bg-card text-center"><span className="text-lg font-semibold tabular-nums">{formatValue(total)}</span><span className="mt-0.5 text-[10px] text-muted-foreground">{centerLabel}</span></div></div><div className="min-w-0 flex-1 space-y-2">{normalized.map((segment) => <div key={segment.label} className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} /><span className="flex-1 truncate text-muted-foreground">{segment.label}</span><span className="tabular-nums">{formatValue(segment.value)}</span></div>)}</div></div></section>;
}

function formatWan(value: number) {
  const absolute = Math.abs(value);
  const amount = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${Math.round(absolute).toLocaleString("zh-CN")}`;
  return value < 0 ? `-${amount}` : amount;
}
