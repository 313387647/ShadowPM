import { notFound } from "next/navigation";
import { Calendar, Coins, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectDetail } from "@/actions/project-actions";
import { getProjectTasks } from "@/actions/task-actions";
import { getProjectLedger, getProjectBudgetBalance, getProjectTasksForSelect } from "@/actions/ledger-actions";
import { getProjectTimeline } from "@/actions/timeline-actions";
import { getProjectPhases } from "@/actions/phase-actions";
import { getProjectCalendarEntries } from "@/actions/calendar-actions";
import { getProjectFeedback } from "@/actions/feedback-actions";
import { LedgerTable } from "@/components/project/LedgerTable";
import { TimelineView } from "@/components/project/TimelineView";
import { TaskViewToggle } from "@/components/project/TaskViewToggle";
import { ExecutionCalendarView } from "@/components/project/ExecutionCalendarView";
import { ProjectFeedbackPanel } from "@/components/project/ProjectFeedbackPanel";

interface Props {
  params: { id: string };
  searchParams?: { tab?: string };
}

const PROJECT_TABS = ["tasks", "timeline", "ledger", "calendar"];

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  // ⚡ Promise.all() 并发请求 —— 消除串行瀑布流
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
  ]);

  if (!project) notFound();

  const { balance, used, allocatedBudget, plannedBudget, usagePercent } = budgetData;
  const activeTab = PROJECT_TABS.includes(searchParams?.tab ?? "")
    ? searchParams?.tab ?? "tasks"
    : "tasks";

  return (
    <div className="p-6 space-y-6">
      {/* 项目头部 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {project.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-3.5" />
              {project.owner.name}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="size-3.5" />
              <span className="font-mono font-medium text-foreground">
                ¥{project.totalBudget.toLocaleString("zh-CN")}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {project.startDate
                ? new Date(project.startDate).toLocaleDateString("zh-CN")
                : "未定"}
              {" — "}
              {project.endDate
                ? new Date(project.endDate).toLocaleDateString("zh-CN")
                : "未定"}
            </span>
            <Badge variant="secondary">{project._count.tasks} 个管控事项</Badge>
          </div>
        </div>
      </div>

      {/* 四 Tab 布局 */}
      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="w-full justify-start rounded-lg border bg-muted/40 p-1 h-auto gap-0">
          <TabsTrigger
            value="tasks"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            📋 管控总表
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            🕐 项目活动
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            💰 资金账本
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            📆 执行日历
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TaskViewToggle
            projectId={params.id}
            tasks={tasks}
            phases={phases}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineView projectId={params.id} logs={timeline} tasks={taskOptions} />
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
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ExecutionCalendarView projectId={params.id} entries={calendarEntries} tasks={taskOptions} />
        </TabsContent>
      </Tabs>

      <ProjectFeedbackPanel projectId={params.id} feedbacks={feedbacks} />
    </div>
  );
}
