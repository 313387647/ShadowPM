"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardList } from "lucide-react";
import { CreateProjectForm } from "@/app/(main)/workspace/CreateProjectForm";
import type { WorkspaceCockpitData } from "@/actions/workspace-actions";

const HEALTH_LABEL = {
  HEALTHY: "健康",
  WATCH: "预警",
  RISK: "风险",
} as const;

export function WorkspaceCockpit({ userName, data }: { userName: string; data: WorkspaceCockpitData }) {
  const activeProjects = data.myProjects.filter((project) => !project.archivedAt);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-7">
      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting()}，{userName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">先处理需要你推进的事项，再安排接下来的执行节点。</p>
        </div>
        <CreateProjectForm />
      </header>

      <section className="grid overflow-hidden rounded-lg border border-border bg-surface-1 sm:grid-cols-3" aria-label="今日行动摘要">
        <Metric icon={<ClipboardList />} label="需要我处理" value={data.metrics.myOpenTasks} detail="分配给我的未完成事项" />
        <Metric icon={<AlertTriangle />} label="已逾期" value={data.metrics.overdueTasks} detail={data.metrics.overdueTasks > 0 ? "建议优先处理" : "当前没有逾期事项"} danger bordered />
        <Metric icon={<CalendarDays />} label="未来 7 天节点" value={data.metrics.upcomingCalendar} detail="已排期的正式执行节点" bordered />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="table-shell">
          <PanelHeader title="需要我处理" description="按逾期、截止时间和优先级排序" />
          <div className="divide-y divide-border">
            {data.myTasks.length === 0 ? <Empty text="当前没有分配给你的待处理事项。" /> : data.myTasks.map((task) => (
              <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.045]">
                <StatusMarker overdue={task.isOverdue} status={task.status} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName}</p></div>
                <p className={task.isOverdue ? "shrink-0 text-xs font-medium text-destructive" : "shrink-0 text-xs text-muted-foreground"}>{task.deadline ? formatDate(task.deadline) : "待补日期"}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="table-shell">
          <PanelHeader title="未来 7 天" description="跨项目的正式执行节点" />
          <div className="divide-y divide-border">
            {data.upcomingCalendar.length === 0 ? <Empty text="未来 7 天暂无正式执行节点。" /> : data.upcomingCalendar.map((entry) => (
              <Link key={entry.id} href={`/projects/${entry.projectId}?tab=calendar`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.045]">
                <div className="w-12 shrink-0 text-center"><p className="text-xs font-medium">{formatDate(entry.date)}</p><p className="mt-1 text-[11px] text-muted-foreground">{entry.startTime ?? "待定"}</p></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{entry.content}</p><p className="mt-1 truncate text-xs text-muted-foreground">{entry.channel ?? "渠道待确认"} · {entry.projectName}</p></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="table-shell" id="my-projects">
        <PanelHeader title="我的项目" description="只显示我负责或参与的项目" action={<Link href="/projects" className="text-xs font-medium text-primary hover:text-primary/80">查看全部</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/25 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">项目</th><th className="px-3 py-2.5 font-medium">健康状态</th><th className="px-3 py-2.5 font-medium">需要我处理</th><th className="px-3 py-2.5 font-medium">下一节点</th><th className="px-3 py-2.5 font-medium">预算信号</th><th className="px-3 py-2.5 font-medium">最后更新</th></tr></thead>
            <tbody className="divide-y divide-border">
              {activeProjects.length === 0 ? <tr><td colSpan={6}><Empty text="当前没有进行中的项目。" /></td></tr> : activeProjects.map((project) => <tr key={project.id} className="transition-colors hover:bg-primary/[0.04]"><td className="px-4 py-3"><Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">{project.name}</Link><p className="mt-1 text-xs text-muted-foreground">{lifecycleLabel(project.lifecycle)}</p></td><td className="px-3 py-3"><HealthBadge health={project.health} /></td><td className="px-3 py-3 tabular-nums">{project.needsMyAttention}</td><td className="px-3 py-3"><p className="max-w-48 truncate text-xs">{project.nextNode?.content ?? "待排期"}</p><p className="mt-1 text-[11px] text-muted-foreground">{project.nextNode ? formatDate(project.nextNode.date) : ""}</p></td><td className={`px-3 py-3 text-xs ${project.budgetTone === "danger" ? "text-destructive" : project.budgetTone === "warning" ? "text-warning" : "text-muted-foreground"}`}>{project.budgetSignal}</td><td className="px-3 py-3 text-xs text-muted-foreground">{formatRelative(project.updatedAt)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <PanelHeader title="项目动态" description="只保留最近 3 条正式活动记录" />
        <div className="divide-y divide-border">
          {data.activities.slice(0, 3).length === 0 ? <Empty text="项目有变化后，会在这里汇总。" /> : data.activities.slice(0, 3).map((activity) => <Link key={activity.id} href={`/projects/${activity.projectId}?tab=timeline`} className="flex gap-3 px-3 py-3 transition-colors hover:bg-primary/[0.045]"><div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm">{activity.summary}</p><p className="mt-1 text-xs text-muted-foreground">{activity.projectName} · {formatRelative(activity.createdAt)}</p></div></Link>)}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail, danger = false, bordered = false }: { icon: React.ReactNode; label: string; value: number; detail: string; danger?: boolean; bordered?: boolean }) { return <div className={bordered ? "border-t border-border px-4 py-4 sm:border-l sm:border-t-0" : "px-4 py-4"}><div className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</div><p className={danger ? "mt-2 text-2xl font-semibold tabular-nums text-destructive" : "mt-2 text-2xl font-semibold tabular-nums"}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>; }
function PanelHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>{action}</div>; }
function StatusMarker({ overdue, status }: { overdue: boolean; status: string }) { return <span className={overdue ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-[10px] font-semibold text-destructive" : status === "IN_PROGRESS" ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-[10px] font-semibold text-primary" : "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[10px] font-semibold text-muted-foreground"}>{overdue ? "逾期" : status === "IN_PROGRESS" ? "进行" : "待启"}</span>; }
function HealthBadge({ health }: { health: WorkspaceCockpitData["myProjects"][number]["health"] }) { const tone = health === "RISK" ? "text-destructive" : health === "WATCH" ? "text-warning" : "text-success"; return <span className={`text-xs font-medium ${tone}`}>{HEALTH_LABEL[health]}</span>; }
function Empty({ text }: { text: string }) { return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>; }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"; }
function lifecycleLabel(lifecycle: WorkspaceCockpitData["myProjects"][number]["lifecycle"]) { return lifecycle === "UPCOMING" ? "待启动" : lifecycle === "COMPLETED" ? "已完成" : "进行中"; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatRelative(value: Date) { const diff = Date.now() - new Date(value).getTime(); if (diff < 60 * 1000) return "刚刚"; if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`; if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`; return `${Math.floor(diff / 86400000)} 天前`; }
