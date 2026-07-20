"use client";

import Link from "next/link";
import { useState } from "react";
import { NewProjectButton } from "@/app/(main)/workspace/CreateProjectForm";
import type { WorkspaceCockpitData } from "@/actions/workspace-actions";

const HEALTH_LABEL = {
  HEALTHY: "健康",
  WATCH: "预警",
  RISK: "风险",
} as const;

export function WorkspaceCockpit({ userName, data }: { userName: string; data: WorkspaceCockpitData }) {
  const activeProjects = data.myProjects.filter((project) => !project.archivedAt);
  const [taskScope, setTaskScope] = useState<"open" | "overdue">("open");
  const visibleTasks = taskScope === "overdue" ? data.myTasks.filter((task) => task.isOverdue) : data.myTasks;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-7">
      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting()}，{userName}</h1>
          <div className="mt-2 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
            <button type="button" onClick={() => setTaskScope("open")} className={taskScope === "open" ? "font-medium text-foreground" : "hover:text-foreground"}>{data.metrics.myOpenTasks} 项待处理</button>
            <span>·</span>
            <button type="button" onClick={() => setTaskScope("overdue")} className={taskScope === "overdue" ? "font-medium text-destructive" : "hover:text-foreground"}>{data.metrics.overdueTasks} 项已逾期</button>
            <span>·</span>
            <a href="#upcoming" className="hover:text-foreground">未来 7 天 {data.metrics.upcomingCalendar} 个节点</a>
          </div>
        </div>
        <NewProjectButton />
      </header>

      <section className="table-shell grid overflow-hidden lg:grid-cols-2" aria-label="个人工作面">
        <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r" id="my-tasks">
          <PanelHeader title={taskScope === "overdue" ? "已逾期" : "需要我处理"} />
          <div className="divide-y divide-border">
            {visibleTasks.length === 0 ? <Empty text={taskScope === "overdue" ? "当前没有逾期事项。" : "当前没有分配给你的待处理事项。"} /> : visibleTasks.map((task) => (
              <Link key={task.id} href={`/projects/${task.projectId}?tab=tasks&focusTask=${task.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.045]">
                <StatusMarker overdue={task.isOverdue} status={task.status} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName}</p></div>
                <p className={task.isOverdue ? "shrink-0 text-xs font-medium text-destructive" : "shrink-0 text-xs text-muted-foreground"}>{task.deadline ? formatDate(task.deadline) : "待补日期"}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="min-w-0" id="upcoming">
          <PanelHeader title="未来 7 天" />
          <div className="divide-y divide-border">
            {data.upcomingCalendar.length === 0 ? <Empty text="未来 7 天暂无正式执行节点。" /> : data.upcomingCalendar.map((entry) => (
              <Link key={entry.id} href={`/projects/${entry.projectId}?tab=calendar`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.045]">
                <div className="w-12 shrink-0 text-center"><p className="text-xs font-medium">{formatDate(entry.date)}</p><p className="mt-1 text-[11px] text-muted-foreground">{entry.startTime ?? "待定"}</p></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{entry.content}</p><p className="mt-1 truncate text-xs text-muted-foreground">{entry.channel ?? "未标注渠道"} · {entry.projectName}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="table-shell" id="my-projects">
        <PanelHeader title="正在推进的项目" action={<Link href="/projects" className="text-xs font-medium text-primary hover:text-primary/80">查看全部</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-border bg-muted/25 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">项目</th><th className="px-3 py-2.5 font-medium">下一步</th><th className="px-3 py-2.5 font-medium">异常信号</th><th className="px-3 py-2.5 font-medium">最后更新</th></tr></thead>
            <tbody className="divide-y divide-border">
              {activeProjects.length === 0 ? <tr><td colSpan={4}><Empty text="当前没有进行中的项目。" /></td></tr> : activeProjects.map((project) => <tr key={project.id} className="transition-colors hover:bg-primary/[0.04]"><td className="px-4 py-3"><Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">{project.name}</Link><p className="mt-1 text-xs text-muted-foreground">{lifecycleLabel(project.lifecycle)}</p></td><td className="px-3 py-3"><p className="max-w-64 truncate text-xs">{project.nextNode?.content ?? "待安排下一节点"}</p><p className="mt-1 text-[11px] text-muted-foreground">{project.nextNode ? formatDate(project.nextNode.date) : ""}</p></td><td className="px-3 py-3"><ProjectSignal project={project} /></td><td className="px-3 py-3 text-xs text-muted-foreground">{formatRelative(project.updatedAt)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2>{action}</div>; }
function StatusMarker({ overdue, status }: { overdue: boolean; status: string }) { return <span className={overdue ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-[10px] font-semibold text-destructive" : status === "IN_PROGRESS" ? "flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-[10px] font-semibold text-primary" : "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[10px] font-semibold text-muted-foreground"}>{overdue ? "逾期" : status === "IN_PROGRESS" ? "进行" : "待启"}</span>; }
function ProjectSignal({ project }: { project: WorkspaceCockpitData["myProjects"][number] }) { if (project.budgetTone !== "default") return <span className={project.budgetTone === "danger" ? "text-xs font-medium text-destructive" : "text-xs font-medium text-warning"}>{project.budgetSignal}</span>; if (project.health !== "HEALTHY") return <span className={project.health === "RISK" ? "text-xs font-medium text-destructive" : "text-xs font-medium text-warning"}>{HEALTH_LABEL[project.health]}</span>; if (project.needsMyAttention > 0) return <span className="text-xs font-medium text-primary">{project.needsMyAttention} 项待处理</span>; return null; }
function Empty({ text }: { text: string }) { return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>; }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"; }
function lifecycleLabel(lifecycle: WorkspaceCockpitData["myProjects"][number]["lifecycle"]) { return lifecycle === "UPCOMING" ? "待启动" : lifecycle === "COMPLETED" ? "已完成" : "进行中"; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatRelative(value: Date) { const diff = Date.now() - new Date(value).getTime(); if (diff < 60 * 1000) return "刚刚"; if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`; if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`; return `${Math.floor(diff / 86400000)} 天前`; }
