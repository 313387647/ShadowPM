import { notFound } from "next/navigation";
import { CalendarDays, Clock3, Eye, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { getSharedProject } from "@/lib/project-share";

export const dynamic = "force-dynamic";

export default async function SharedProjectPage({ params }: { params: { token: string } }) {
  const shared = await getSharedProject(params.token);
  if (!shared) notFound();
  const { project, budget } = shared;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-[#0b0d0c] text-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded bg-white text-xs font-bold text-black">S</span>
            <span className="font-semibold">ShadowPM</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-400"><Eye className="size-3.5" />只读项目视图</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <section className="grid gap-5 border-b pb-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-medium text-muted-foreground">外部协作视图</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>负责人 {project.owner.name}</span>
              <span>{formatDate(project.startDate)} — {formatDate(project.endDate)}</span>
              <span>{project.tasks.length} 项管控事项</span>
            </div>
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card">
            <Metric label="已确认预算" value={formatMoney(budget.confirmed)} />
            <Metric label="可用结余" value={formatMoney(budget.balance)} border />
            <div className="col-span-2 border-t px-3 py-2 text-xs text-muted-foreground">
              已编排 {formatMoney(budget.allocated)} · 实际支出 {formatMoney(budget.consumed)} · 使用率 {budget.usagePercent}%
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">项目管控总表</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">由项目负责人维护，当前页面不可编辑</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-muted/35 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">工作流 / 管控事项</th>
                  <th className="px-3 py-2.5 font-medium">负责人</th>
                  <th className="px-3 py-2.5 font-medium">截止</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium">进度或结论</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {project.tasks.map((task) => (
                  <tr key={task.id} className="align-top">
                    <td className="max-w-[420px] px-3 py-3">
                      <p className="text-[11px] text-muted-foreground">{task.phase?.name ?? "未分组"}</p>
                      <p className="mt-0.5 font-medium">{task.name}</p>
                      {task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p>}
                    </td>
                    <td className="px-3 py-3"><p>{task.assignee ?? "待确认"}</p><p className="text-xs text-muted-foreground">{task.department ?? ""}</p></td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDate(task.deadline)}</td>
                    <td className="px-3 py-3"><Badge variant="outline">{TASK_STATUS_MAP[task.status]}</Badge></td>
                    <td className="max-w-[300px] px-3 py-3 text-xs leading-5 text-muted-foreground">{task.notes ?? "暂无更新"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3"><WalletCards className="size-4" /><h2 className="text-sm font-semibold">预算规划</h2></div>
            <div className="divide-y">
              {project.budgetItems.slice(0, 20).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.status}{item.taskNames.length ? ` · ${item.taskNames.join("、")}` : ""}</p></div>
                  <span className="shrink-0 font-mono tabular-nums">{formatMoney(item.plannedAmount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3"><CalendarDays className="size-4" /><h2 className="text-sm font-semibold">执行日历</h2></div>
            <div className="divide-y">
              {project.calendarEntries.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无执行排期</p> : project.calendarEntries.slice(0, 20).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-16 shrink-0 text-xs text-muted-foreground"><p>{formatDate(entry.date)}</p>{entry.startTime && <p className="mt-1 flex items-center gap-1"><Clock3 className="size-3" />{entry.startTime}</p>}</div>
                  <div className="min-w-0"><p className="text-sm font-medium">{entry.content}</p><p className="mt-1 text-xs text-muted-foreground">{[entry.workstream, entry.channel, entry.owner].filter(Boolean).join(" · ") || "信息待确认"}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <p className="border-t pt-4 text-xs text-muted-foreground">链接有效至 {shared.expiresAt ? shared.expiresAt.toLocaleString("zh-CN") : "长期有效"}。内容由项目负责人维护。</p>
      </div>
    </main>
  );
}

function Metric({ label, value, border = false }: { label: string; value: string; border?: boolean }) {
  return <div className={border ? "border-l px-3 py-3" : "px-3 py-3"}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono font-medium tabular-nums">{value}</p></div>;
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString("zh-CN")}`;
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("zh-CN") : "待确认";
}
