"use client";

import Link from "next/link";
import { Activity, AlertTriangle, CircleDollarSign, ClipboardList, FolderKanban } from "lucide-react";
import { CreateProjectForm } from "@/app/(main)/workspace/CreateProjectForm";
import type { WorkspaceCockpitData } from "@/actions/workspace-actions";

const HEALTH_STYLE = {
  HEALTHY: { label: "健康", className: "bg-success" },
  WATCH: { label: "预警", className: "bg-warning" },
  RISK: { label: "风险", className: "bg-destructive" },
} as const;

export function WorkspaceCockpit({ userName, data }: { userName: string; data: WorkspaceCockpitData }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-7">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface-1/70 px-5 py-7 sm:px-7 sm:py-8">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="section-kicker">今日项目控制面板</p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{greeting()}，{userName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">先处理逾期、待处理事项与未来七天的正式执行节点。</p>
          </div>
          <CreateProjectForm />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric icon={<FolderKanban />} label="进行中项目" value={data.metrics.activeProjects} detail={`待启动 ${data.metrics.upcomingProjects} · 已完成 ${data.metrics.completedProjects}`} />
        <Metric icon={<ClipboardList />} label="待处理事项" value={data.metrics.myOpenTasks} detail="分配给我" />
        <Metric icon={<AlertTriangle />} label="逾期事项" value={data.metrics.overdueTasks} detail="优先处理" tone={data.metrics.overdueTasks > 0 ? "danger" : "default"} />
        <Metric icon={<CircleDollarSign />} label="确认预算结余" value={formatMoney(data.metrics.confirmedBalance)} detail="来自正式流水" />
        <Metric icon={<Activity />} label="本月支出" value={formatMoney(data.metrics.periodExpense)} detail="已发生费用" />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="table-shell lg:col-span-5">
          <PanelHeader title="我的待处理事项" description="按逾期、截止时间和优先级排序" action={data.metrics.myOpenTasks > data.myTasks.length ? <span className="text-xs text-muted-foreground">显示前 {data.myTasks.length} 项</span> : undefined} />
          <div className="divide-y divide-border">
            {data.myTasks.length === 0 ? <Empty text="当前没有分配给你的待处理事项。" /> : data.myTasks.map((task) => (
              <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-primary/[0.045]">
                <span className={task.isOverdue ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-[10px] font-semibold text-destructive" : task.status === "IN_PROGRESS" ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-[10px] font-semibold text-primary" : "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[10px] font-semibold text-muted-foreground"}>{task.status === "IN_PROGRESS" ? "进行" : "待启"}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName}</p></div>
                <div className="shrink-0 text-right"><p className={task.isOverdue ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{task.deadline ? formatDeadline(task.deadline) : "待补日期"}</p><p className="mt-1 text-[10px] text-muted-foreground">{task.priority}</p></div>
              </Link>
            ))}
          </div>
        </section>

        <HealthPanel health={data.health} />

        <section className="table-shell lg:col-span-4">
          <PanelHeader title="项目动态" description="来自正式活动记录" />
          <div className="divide-y divide-border">
            {data.activities.length === 0 ? <Empty text="项目有变化后，会在这里汇总。" /> : data.activities.map((activity) => (
              <Link key={activity.id} href={`/projects/${activity.projectId}?tab=timeline`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-primary/[0.045]">
                <span className={activity.source === "AI" || activity.source === "IMPORT" ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary" : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground"}><Activity className="size-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm leading-5">{activity.summary}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{activity.projectName} · {formatRelative(activity.createdAt)}</p></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="table-shell">
        <PanelHeader title="执行日历" description="未来 7 天的正式节点" />
        <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          {data.upcomingCalendar.length === 0 ? <Empty text="未来 7 天暂无正式执行节点。" /> : data.upcomingCalendar.map((entry) => (
            <Link key={entry.id} href={`/projects/${entry.projectId}?tab=calendar`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-primary/[0.045]">
              <div className="w-11 shrink-0 text-center"><p className="text-xs font-medium">{formatDay(entry.date)}</p><p className="mt-1 text-[10px] text-muted-foreground">{entry.startTime ?? "待定"}</p></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{entry.content}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{entry.channel ?? "渠道待确认"} · {entry.projectName}</p></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthPanel({ health }: { health: WorkspaceCockpitData["health"] }) {
  const total = health.HEALTHY + health.WATCH + health.RISK;
  const healthyStop = total ? Math.round((health.HEALTHY / total) * 100) : 0;
  const watchStop = healthyStop + (total ? Math.round((health.WATCH / total) * 100) : 0);
  const chartBackground = total === 0
    ? "hsl(var(--secondary))"
    : `conic-gradient(hsl(var(--success)) 0 ${healthyStop}%, hsl(var(--warning)) ${healthyStop}% ${watchStop}%, hsl(var(--destructive)) ${watchStop}% 100%)`;
  return <section className="table-shell lg:col-span-3"><PanelHeader title="项目健康分布" description="可解释的关注信号" /><div className="space-y-4 p-4"><div className="flex items-center gap-4"><div className="flex size-24 shrink-0 items-center justify-center rounded-full border border-border p-2" role="img" aria-label={`健康 ${health.HEALTHY} 个，预警 ${health.WATCH} 个，风险 ${health.RISK} 个`} style={{ background: chartBackground }}><div className="flex size-full flex-col items-center justify-center rounded-full border border-border bg-surface-1"><span className="text-xl font-semibold tabular-nums">{total}</span><span className="text-[10px] text-muted-foreground">个项目</span></div></div><div className="min-w-0 flex-1 space-y-2"><HealthLine level="HEALTHY" count={health.HEALTHY} total={total} /><HealthLine level="WATCH" count={health.WATCH} total={total} /><HealthLine level="RISK" count={health.RISK} total={total} /></div></div><p className="text-[11px] leading-5 text-muted-foreground">风险由逾期、超支或先支出触发；预警由未安排负责人/日期或预算高消耗触发。</p></div></section>;
}

function Metric({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone?: "default" | "danger" }) { return <div className="surface-panel rounded-xl px-4 py-3.5"><div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{label}</span><span className={tone === "danger" ? "text-destructive" : "text-primary"}>{icon}</span></div><p className={tone === "danger" ? "mt-2 text-2xl font-semibold tabular-nums text-destructive" : "mt-2 text-2xl font-semibold tabular-nums"}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>; }
function PanelHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>{action}</div>; }
function HealthLine({ level, count, total }: { level: keyof typeof HEALTH_STYLE; count: number; total: number }) { const item = HEALTH_STYLE[level]; return <div className="flex items-center gap-2 text-xs"><span className={`size-2 rounded-full ${item.className}`} /><span className="flex-1 text-muted-foreground">{item.label}</span><span className="tabular-nums">{count}</span><span className="w-8 text-right text-muted-foreground">{total > 0 ? Math.round((count / total) * 100) : 0}%</span></div>; }
function Empty({ text }: { text: string }) { return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{text}</div>; }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"; }
function formatMoney(value: number) { const absolute = Math.abs(value); const amount = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${Math.round(absolute).toLocaleString("zh-CN")}`; return value < 0 ? `-${amount}` : amount; }
function formatDeadline(value: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDay(value: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatRelative(value: Date) { const diff = Date.now() - new Date(value).getTime(); if (diff < 60 * 1000) return "刚刚"; if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`; if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`; return `${Math.floor(diff / 86400000)} 天前`; }
