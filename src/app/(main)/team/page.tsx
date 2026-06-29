import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTeamWorkload } from "@/actions/health-actions";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");

  const members = await getTeamWorkload();
  const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
  const totalTasks = members.reduce((s, m) => s + m.total, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">👥 团队工作负载</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} 名成员 · {totalTasks} 个进行中任务 · {totalOverdue} 个逾期
          </p>
        </div>
      </div>

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
                <span className="text-sm font-medium">{m.load}</span>
              </div>

              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {m.inProgress} 进行中
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className={`size-3 ${m.overdue > 0 ? "text-destructive" : ""}`} /> {m.overdue} 逾期
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> {m.pending} 待启动
                </span>
              </div>

              {m.tasks.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  {m.tasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/projects/${t.projectId}`}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className={`size-1.5 rounded-full ${t.status === "IN_PROGRESS" ? "bg-blue-500" : "bg-muted-foreground"}`} />
                      <span className="truncate">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">{t.projectName}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
