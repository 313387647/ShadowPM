import { getCurrentUser } from "@/lib/auth";
import { getUserProjects } from "@/actions/project-actions";
import { prisma } from "@/lib/prisma";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectCard } from "./ProjectCard";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight, Clock, LayoutDashboard } from "lucide-react";

export default async function WorkspacePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const taskProjectScope = user.role === "LEADER"
    ? {}
    : {
        project: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
      };

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
  const ownedProjects = projects.filter((project) => project.ownerId === user.id);
  const sharedProjects = projects.filter((project) => project.ownerId !== user.id);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">个人工作台</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{user.name}，今天先处理什么？</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalMyTasks > 0
              ? `有 ${totalMyTasks} 个待处理事项，其中 ${overdueTasks.length} 个已逾期。`
              : "当前没有分配给你的待处理事项。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "LEADER" && (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" />
              查看大盘
            </Link>
          )}
          <CreateProjectForm />
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">我的管控事项</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">按截止时间和当前状态排序</p>
            </div>
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
            <div className="overflow-hidden rounded-lg border bg-card">
              {myTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project.id}`}
                  className="group flex items-center gap-3 border-b px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/45"
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                      task.status === "IN_PROGRESS"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {task.status === "IN_PROGRESS" ? "进行" : "待启"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">{task.project.name}</span>
                      {task.deadline && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="size-3" />
                          {new Date(task.deadline).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div className="rounded-lg border border-destructive/25 bg-destructive/[0.035] p-4">
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
        </section>

        <aside className="min-w-0 space-y-6 lg:border-l lg:pl-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold">项目</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{projects.length} 个可编辑项目</p>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center">
              <p className="text-xs text-muted-foreground">暂无项目</p>
            </div>
          ) : (
            <div className="space-y-5">
              <ProjectGroup title="我负责的项目" projects={ownedProjects} />
              {sharedProjects.length > 0 && (
                <ProjectGroup title="协作项目" projects={sharedProjects} />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ProjectGroup({
  title,
  projects,
}: {
  title: string;
  projects: Awaited<ReturnType<typeof getUserProjects>>;
}) {
  if (projects.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{projects.length}</span>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
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
    </section>
  );
}
