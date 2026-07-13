import { notFound } from "next/navigation";
import { AlertTriangle, Calendar, CalendarDays, CheckCircle2, ClipboardList, Coins, Eye, History, User, WalletCards } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectDetail } from "@/actions/project-actions";
import { getProjectTasks } from "@/actions/task-actions";
import { getProjectLedger, getProjectBudgetBalance, getProjectTasksForSelect } from "@/actions/ledger-actions";
import { getProjectTimeline } from "@/actions/timeline-actions";
import { getProjectPhases } from "@/actions/phase-actions";
import { getProjectCalendarEntries } from "@/actions/calendar-actions";
import { getProjectFeedback } from "@/actions/feedback-actions";
import { getProjectMembers } from "@/actions/member-actions";
import { getProjectOutputs } from "@/actions/project-output-actions";
import { LedgerTable } from "@/components/project/LedgerTable";
import { TimelineView } from "@/components/project/TimelineView";
import { TaskViewToggle } from "@/components/project/TaskViewToggle";
import { ExecutionCalendarView } from "@/components/project/ExecutionCalendarView";
import { ProjectFeedbackPanel } from "@/components/project/ProjectFeedbackPanel";
import { ProjectMembersPanel } from "@/components/project/ProjectMembersPanel";
import { ProjectOutputsPanel } from "@/components/project/ProjectOutputsPanel";
import { getBudgetSignal } from "@/lib/budget-signals";

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
    flows,
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
    getProjectLedger(params.id),
    getProjectBudgetBalance(params.id),
    getProjectTasksForSelect(params.id),
    getProjectTimeline(params.id),
    getProjectPhases(params.id),
    getProjectCalendarEntries(params.id),
    getProjectFeedback(params.id),
    getProjectMembers(params.id),
    getProjectOutputs(params.id),
  ]);

  if (!project) notFound();

  const { balance, used, allocatedBudget, plannedBudget, usagePercent } = budgetData;
  const budgetSignal = getBudgetSignal({
    plannedBudget,
    allocatedBudget,
    balance,
    used,
    usagePercent,
    flowCount: flows.length,
  });
  const budgetIsConfirmed = allocatedBudget > 0;
  const hasOverspend = balance < 0 && budgetIsConfirmed;
  const hasUnconfirmedSpend = allocatedBudget === 0 && used > 0;
  const hasBudgetRisk = budgetSignal.level === "HIGH";
  const activeTab = PROJECT_TABS.includes(searchParams?.tab ?? "")
    ? searchParams?.tab ?? "tasks"
    : "tasks";

  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-7">
      <header className="border-b border-border/80 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-normal">项目控制中心</Badge>
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
                <span className="font-mono font-medium text-foreground">¥{project.totalBudget.toLocaleString("zh-CN")}</span>
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
          <div className="flex w-full flex-col items-end gap-2 lg:w-auto lg:min-w-[280px]">
            <ProjectOutputsPanel projectId={params.id} canEdit={project.canEdit} data={projectOutputs} />
            <div className="w-full rounded-lg border bg-muted/20 p-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-background px-3 py-2">
                  <p className="text-muted-foreground">{budgetIsConfirmed ? "已确认预算" : "计划预算"}</p>
                  <p className="mt-1 font-mono font-medium">¥{(budgetIsConfirmed ? allocatedBudget : plannedBudget).toLocaleString("zh-CN")}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{budgetIsConfirmed ? `计划 ¥${plannedBudget.toLocaleString("zh-CN")}` : "尚未进入资金账本"}</p>
                </div>
                <div className="rounded-md bg-background px-3 py-2">
                  <p className={hasBudgetRisk ? "text-destructive" : "text-muted-foreground"}>{hasOverspend ? "超支金额" : hasUnconfirmedSpend ? "已记录支出" : budgetIsConfirmed ? "可用结余" : "资金状态"}</p>
                  <p className={hasBudgetRisk ? "mt-1 font-mono font-medium text-destructive" : "mt-1 font-mono font-medium"}>
                    {hasOverspend ? `¥${Math.abs(balance).toLocaleString("zh-CN")}` : hasUnconfirmedSpend ? `¥${used.toLocaleString("zh-CN")}` : budgetIsConfirmed ? `¥${balance.toLocaleString("zh-CN")}` : "待确认"}
                  </p>
                  <p className={hasBudgetRisk ? "mt-1 flex items-center gap-1 text-[10px] text-destructive" : "mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"}>
                    {budgetSignal.level === "OK" ? <CheckCircle2 className="size-3 text-emerald-600" /> : <AlertTriangle className="size-3" />}
                    {budgetSignal.title}
                  </p>
                </div>
              </div>
              <p className="px-1 pt-2 text-[10px] leading-4 text-muted-foreground">{budgetSignal.description}</p>
            </div>
          </div>
        </div>
      </header>

      {!project.canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
          当前以只读视角查看该项目。你可以查看管控表、活动、预算和日历，但只有项目主负责人或可编辑协作者可以修改。
        </div>
      )}

      {projectMembers && <ProjectMembersPanel projectId={params.id} data={projectMembers} />}

      {/* 四 Tab 布局 */}
      <Tabs key={activeTab} defaultValue={activeTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-muted/20 p-1">
          <TabsTrigger
            value="tasks"
            className="shrink-0 gap-1.5 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <ClipboardList className="size-3.5" />管控总表
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="shrink-0 gap-1.5 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <History className="size-3.5" />项目活动
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            className="shrink-0 gap-1.5 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <WalletCards className="size-3.5" />资金账本
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="shrink-0 gap-1.5 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
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
          <LedgerTable
            plannedBudget={plannedBudget}
            allocatedBudget={allocatedBudget}
            balance={balance}
            used={used}
            usagePercent={usagePercent}
            flows={flows}
            tasks={taskOptions}
            canEdit={project.canEdit}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ExecutionCalendarView projectId={params.id} entries={calendarEntries} tasks={taskOptions} canEdit={project.canEdit} />
        </TabsContent>
      </Tabs>

      <ProjectFeedbackPanel projectId={params.id} feedbacks={feedbacks} />
    </div>
  );
}
