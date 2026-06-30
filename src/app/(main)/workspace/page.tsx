import { getCurrentUser } from "@/lib/auth";
import { getUserProjects } from "@/actions/project-actions";
import { prisma } from "@/lib/prisma";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectCard } from "./ProjectCard";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export default async function WorkspacePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const taskProjectScope = user.role === "LEADER" ? {} : { project: { ownerId: user.id } };

  const [projects, myTasks, overdueTasks] = await Promise.all([
    getUserProjects(),
    prisma.task.findMany({
      where: { assignee: user.name, status: { not: "COMPLETED" }, ...taskProjectScope },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        assignee: user.name,
        ...taskProjectScope,
        deadline: { lt: new Date() },
        status: { not: "COMPLETED" },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { deadline: "asc" },
      take: 3,
    }),
  ]);

  const inProgressTasks = myTasks.filter((t) => t.status === "IN_PROGRESS");
  const pendingTasks = myTasks.filter((t) => t.status === "PENDING");
  const totalMyTasks = inProgressTasks.length + pendingTasks.length;

  return (
    <div className="p-6 space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🤖 AI 工作台</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user.name}，下午好。今天有 {totalMyTasks} 个管控事项待处理
          </p>
        </div>
        <CreateProjectForm />
      </div>

      {/* ── 三列布局 ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左栏：今日待办 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">📋 我的管控事项</h2>
            <span className="text-xs text-muted-foreground">
              进行中 {inProgressTasks.length} · 待启动 {pendingTasks.length}
            </span>
          </div>

          {myTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
              <CheckCircle2 className="size-8 text-emerald-500 mb-2" />
              <p className="text-sm font-medium">今天没有待处理的管控事项</p>
              <p className="text-xs text-muted-foreground mt-1">
                去项目管控表里分配事项吧
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/30 hover:shadow-sm"
                >
                  {/* 状态标记 */}
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                      task.status === "IN_PROGRESS"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {task.status === "IN_PROGRESS" ? "▶" : "⏳"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{task.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{task.project.name}</span>
                      {task.deadline && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="size-3" />
                          {new Date(task.deadline).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] shrink-0 rounded-full px-2 py-0.5 font-medium ${
                      task.status === "IN_PROGRESS"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {task.status === "IN_PROGRESS" ? "进行中" : "待启动"}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* 逾期提醒 */}
          {overdueTasks.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="size-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">
                  {overdueTasks.length} 个管控事项已逾期
                </h3>
              </div>
              {overdueTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-destructive/10"
                >
                  <span className="truncate">{task.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {task.project.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 右栏：项目概览 */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">📁 我的项目</h2>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center">
              <p className="text-xs text-muted-foreground">暂无项目</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  totalBudget={project.totalBudget}
                  confirmedBudget={project.confirmedBudget}
                  pendingBudgetSignal={project.pendingBudgetSignal}
                  startDate={project.startDate}
                  endDate={project.endDate}
                  taskCount={project._count.tasks}
                />
              ))}
            </div>
          )}

          {/* 快捷入口 */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">
              ⚡ 快捷操作
            </h3>
            <div className="space-y-1.5">
              <Link
                href="/dashboard"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                📊 查看大盘
              </Link>
              <span className="block text-sm text-muted-foreground/50">
                💬 打开右下角 Copilot 汇报进度
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
