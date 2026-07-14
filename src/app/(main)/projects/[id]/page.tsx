import { notFound } from "next/navigation";
import { Calendar, CalendarDays, ClipboardList, Coins, Eye, History, User, WalletCards } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectDetail } from "@/actions/project-actions";
import { getProjectTasks } from "@/actions/task-actions";
import { getProjectBudgetPlanning, getProjectBudgetTaskOptions } from "@/actions/budget-queries";
import { getProjectTimeline } from "@/actions/timeline-actions";
import { getProjectPhases } from "@/actions/phase-actions";
import { getProjectCalendarEntries } from "@/actions/calendar-actions";
import { getProjectFeedback } from "@/actions/feedback-actions";
import { getProjectMembers } from "@/actions/member-actions";
import { getProjectOutputs } from "@/actions/project-output-actions";
import { BudgetWorkspace } from "@/components/project/budget/BudgetWorkspace";
import { TimelineView } from "@/components/project/TimelineView";
import { TaskViewToggle } from "@/components/project/TaskViewToggle";
import { ExecutionCalendarView } from "@/components/project/ExecutionCalendarView";
import { ProjectFeedbackPanel } from "@/components/project/ProjectFeedbackPanel";
import { ProjectMembersPanel } from "@/components/project/ProjectMembersPanel";
import { ProjectOutputsPanel } from "@/components/project/ProjectOutputsPanel";
import { ProjectManageActions } from "@/components/project/ProjectManageActions";
import { getProjectLifecycle, PROJECT_LIFECYCLE_LABEL } from "@/lib/project-lifecycle";

interface Props {
  params: { id: string };
  searchParams?: { tab?: string };
}

const PROJECT_TABS = ["tasks", "timeline", "ledger", "calendar"];

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  // Load independent project surfaces together to avoid a server-side waterfall.
  const [
    project,
    tasks,
    budgetData,
    taskOptions,
    timeline,
    phases,
    calendarEntries,
    feedbacks,
    projectMembers,
    projectOutputs,
  ] = await Promise.all([
    getProjectDetail(params.id),
    getProjectTasks(params.id),
    getProjectBudgetPlanning(params.id),
    getProjectBudgetTaskOptions(params.id),
    getProjectTimeline(params.id),
    getProjectPhases(params.id),
    getProjectCalendarEntries(params.id),
    getProjectFeedback(params.id),
    getProjectMembers(params.id),
    getProjectOutputs(params.id),
  ]);

  if (!project) notFound();

  if (!budgetData) notFound();
  const budgetIsConfirmed = budgetData.pool.mode === "CONFIRMED";
  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const overdueCount = tasks.filter((task) => task.status !== "COMPLETED" && task.deadline && new Date(task.deadline) < new Date()).length;
  const completedCount = tasks.filter((task) => task.status === "COMPLETED").length;
  const scheduledCount = calendarEntries.filter((entry) => entry.date).length;
  const projectLifecycle = getProjectLifecycle({ startDate: project.startDate, taskStatuses: tasks.map((task) => task.status) });
  const activeTab = PROJECT_TABS.includes(searchParams?.tab ?? "")
    ? searchParams?.tab ?? "tasks"
    : "tasks";

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-7">
      <header className="surface-panel relative overflow-hidden rounded-2xl px-5 py-5 sm:px-6">
        <div className="hero-atmosphere opacity-70" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-normal">项目控制中心</Badge>
              <Badge variant="outline" className={project.archivedAt ? "border-muted-foreground/30 bg-muted text-muted-foreground" : projectLifecycle === "COMPLETED" ? "border-success/25 bg-success/10 text-success" : projectLifecycle === "UPCOMING" ? "border-info/25 bg-info/10 text-info" : "border-primary/25 bg-primary/10 text-primary"}>{project.archivedAt ? "已归档" : PROJECT_LIFECYCLE_LABEL[projectLifecycle]}</Badge>
              {!project.canEdit && <Badge variant="outline" className="gap-1"><Eye className="size-3" />只读巡视</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              {project.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" />
                {project.owner.name}
              </span>
              <span className="flex items-center gap-1.5">
                <Coins className="size-3.5" />
                <span className="font-mono font-medium text-foreground">{budgetIsConfirmed ? `¥${budgetData.pool.totalBudget.toLocaleString("zh-CN")}` : budgetData.pool.mode === "NOT_MANAGED" ? "不管理预算" : "预算待确认"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {project.startDate ? new Date(project.startDate).toLocaleDateString("zh-CN") : "未定"}
                {" — "}
                {project.endDate ? new Date(project.endDate).toLocaleDateString("zh-CN") : "未定"}
              </span>
              <Badge variant="secondary">{project._count.tasks} 项管控事项</Badge>
            </div>
          </div>
          <div className="flex w-full flex-col items-end gap-2 lg:w-auto lg:min-w-[300px]">
            <ProjectManageActions
              project={{ id: project.id, name: project.name, startDate: project.startDate, endDate: project.endDate, archivedAt: project.archivedAt }}
              canManage={project.canManage}
            />
            <ProjectOutputsPanel projectId={params.id} canEdit={project.canEdit} data={projectOutputs} />
            <div className="w-full rounded-xl border border-border bg-canvas/35 p-2 text-xs">
              {budgetIsConfirmed ? <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-surface-1/85 px-3 py-2.5"><p className="text-muted-foreground">项目总预算</p><p className="mt-1 font-mono font-medium">¥{budgetData.pool.totalBudget.toLocaleString("zh-CN")}</p><p className="mt-1 text-[10px] text-muted-foreground">已确认的项目预算池</p></div><div className="rounded-lg bg-surface-1/85 px-3 py-2.5"><p className="text-muted-foreground">剩余可分配</p><p className={budgetData.pool.remainingToAllocate < 0 ? "mt-1 font-mono font-medium text-destructive" : "mt-1 font-mono font-medium"}>¥{budgetData.pool.remainingToAllocate.toLocaleString("zh-CN")}</p><p className="mt-1 text-[10px] text-muted-foreground">已编排 ¥{budgetData.pool.planned.toLocaleString("zh-CN")}</p></div></div> : <p className="px-2 py-2 text-muted-foreground">{budgetData.pool.mode === "NOT_MANAGED" ? "本项目暂不管理预算" : "项目预算待确认"}</p>}
            </div>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-canvas/30 sm:grid-cols-4 sm:divide-y-0">
          <PulseMetric label="进行中" value={inProgressCount} detail="正在推进" />
          <PulseMetric label="已完成" value={completedCount} detail="管控事项" tone={completedCount > 0 ? "success" : "default"} />
          <PulseMetric label="已逾期" value={overdueCount} detail="优先处理" tone={overdueCount > 0 ? "danger" : "default"} />
          <PulseMetric label="已排节点" value={scheduledCount} detail="执行日历" />
        </div>
      </header>

      {!project.canEdit && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          当前以只读视角查看该项目。你可以查看管控表、活动、预算和日历，但只有项目主负责人或可编辑协作者可以修改。
        </div>
      )}

      {/* 四 Tab 布局 */}
      <Tabs key={activeTab} defaultValue={activeTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/70 p-1">
          <TabsTrigger
            value="tasks"
            className="shrink-0 gap-1.5 px-3"
          >
            <ClipboardList className="size-3.5" />管控总表
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="shrink-0 gap-1.5 px-3"
          >
            <History className="size-3.5" />项目活动
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            className="shrink-0 gap-1.5 px-3"
          >
            <WalletCards className="size-3.5" />预算管理
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="shrink-0 gap-1.5 px-3"
          >
            <CalendarDays className="size-3.5" />执行日历
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TaskViewToggle
            projectId={params.id}
            tasks={tasks}
            phases={phases}
            canEdit={project.canEdit}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineView projectId={params.id} logs={timeline} tasks={taskOptions} canEdit={project.canEdit} />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <BudgetWorkspace data={budgetData} tasks={taskOptions} canEdit={project.canEdit} canManage={project.canManage} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ExecutionCalendarView projectId={params.id} entries={calendarEntries} tasks={taskOptions} canEdit={project.canEdit} />
        </TabsContent>
      </Tabs>

      {projectMembers && <ProjectMembersPanel projectId={params.id} data={projectMembers} />}

      <ProjectFeedbackPanel projectId={params.id} feedbacks={feedbacks} />
    </div>
  );
}

function PulseMetric({ label, value, detail, tone = "default" }: { label: string; value: number; detail: string; tone?: "default" | "success" | "danger" }) {
  const valueClass = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return <div className="px-4 py-3.5"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>;
}
