import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTeamWorkload } from "@/actions/health-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Eye, ShieldCheck, UserRoundCheck } from "lucide-react";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");

  const members = await getTeamWorkload();
  const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
  const totalTasks = members.reduce((s, m) => s + m.total, 0);
  const totalProjects = members.reduce((s, m) => s + m.ownedProjectCount, 0);
  const outsideAssignments = members.reduce((s, m) => s + m.assignedOutsideEditable, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">团队权限与负载</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} 名成员 · {totalProjects} 个负责人项目 · {totalTasks} 个活跃事项 · {totalOverdue} 个逾期
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="size-4" />
            管理者视角
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            管理者可以查看全部项目细则，用于通盘巡视；但对非本人项目不直接编辑。
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4" />
            编辑边界
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            项目负责人默认可编辑；负责人也可以授权可编辑协作者。管理者能看全局，但不自动获得编辑权。
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserRoundCheck className="size-4" />
            被指派不等于授权
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            管控事项里的负责人字段用于业务归属，不自动授予项目编辑权限。需要修改项目时必须进入协作者授权。
          </p>
        </div>
      </div>

      {outsideAssignments > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          当前有 {outsideAssignments} 个活跃事项的负责人姓名不属于该项目 owner。它们是业务指派，不代表这些成员已经拥有编辑权限。
        </div>
      )}

      {/* 成员卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                    {m.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.role === "LEADER" ? "管理者" : "成员"}
                    </p>
                  </div>
                </div>
                <Badge variant={m.load === "过载" ? "destructive" : "outline"}>{m.load}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2 text-xs">
                <div>
                  <p className="text-muted-foreground">可编辑项目</p>
                  <p className="mt-0.5 font-semibold">{m.editableProjectCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">读取范围</p>
                  <p className="mt-0.5 font-semibold">{m.readableScope}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">写入范围</p>
                  <p className="mt-0.5 font-semibold">{m.writableScope}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {m.inProgress} 进行中
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className={`size-3 ${m.overdue > 0 ? "text-destructive" : ""}`} /> {m.overdue} 逾期
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> {m.pending} 待启动
                </span>
                {m.missingOwner > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="size-3 text-amber-600" /> {m.missingOwner} 缺负责人
                  </span>
                )}
              </div>

              {m.projects.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">负责人项目</p>
                  {m.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="truncate">{project.name}</span>
                      <span className="shrink-0 text-[10px]">
                        活跃 {project.activeTasks} · 逾期 {project.overdueTasks}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {m.collaboratorProjects.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    协作项目 · 只读 {m.viewerProjectCount}
                  </p>
                  {m.collaboratorProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="truncate">{project.name}</span>
                      <span className="shrink-0 text-[10px]">
                        {project.role === "EDITOR" ? "可编辑" : "只读"} · owner {project.ownerName}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {m.tasks.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">本人项目活跃事项</p>
                  {m.tasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/projects/${t.projectId}?tab=tasks&focusTask=${t.id}`}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className={`size-1.5 rounded-full ${t.status === "IN_PROGRESS" ? "bg-blue-500" : "bg-muted-foreground"}`} />
                      <span className="truncate">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">{t.projectName}</span>
                    </Link>
                  ))}
                </div>
              )}

              {m.assignedOutsideEditable > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                  <p className="font-medium">业务指派但无编辑权：{m.assignedOutsideEditable} 项</p>
                  {m.outsideAssignedTasks.length > 0 && (
                    <div className="mt-1 space-y-1 text-[11px] text-amber-900/80">
                      {m.outsideAssignedTasks.map((task) => (
                        <p key={task.id} className="truncate">
                          {task.name} · {task.projectName}（owner: {task.projectOwnerName}）
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
