import { notFound } from "next/navigation";
import { Calendar, Coins, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectDetail } from "@/actions/project-actions";
import { getProjectTasks } from "@/actions/task-actions";
import { getProjectLedger, getProjectBudgetBalance, getProjectTasksForSelect } from "@/actions/ledger-actions";
import { getProjectTimeline } from "@/actions/timeline-actions";
import { getProjectFolders } from "@/actions/wiki-actions";
import { getProjectPhases } from "@/actions/phase-actions";
import { getPendingImportDrafts } from "@/actions/import-draft-actions";
import { getProjectCalendarEntries } from "@/actions/calendar-actions";
import { getProjectRisks } from "@/actions/risk-actions";
import { LedgerTable } from "@/components/project/LedgerTable";
import { TimelineView } from "@/components/project/TimelineView";
import { WikiExplorer } from "@/components/wiki/WikiExplorer";
import { TaskViewToggle } from "@/components/project/TaskViewToggle";
import { ImportDraftPanel } from "@/components/project/ImportDraftPanel";
import { ExecutionCalendarView } from "@/components/project/ExecutionCalendarView";
import { RiskView } from "@/components/project/RiskView";

interface Props {
  params: { id: string };
  searchParams?: { tab?: string };
}

const PROJECT_TABS = ["tasks", "timeline", "calendar", "ledger", "risks", "wiki"];

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  // ⚡ Promise.all() 并发请求 —— 消除串行瀑布流
  const [
    project,
    tasks,
    flows,
    budgetData,
    taskOptions,
    timeline,
    folders,
    phases,
    importDrafts,
    calendarEntries,
    risks,
  ] = await Promise.all([
    getProjectDetail(params.id),
    getProjectTasks(params.id),
    getProjectLedger(params.id),
    getProjectBudgetBalance(params.id),
    getProjectTasksForSelect(params.id),
    getProjectTimeline(params.id),
    getProjectFolders(params.id),
    getProjectPhases(params.id),
    getPendingImportDrafts(params.id),
    getProjectCalendarEntries(params.id),
    getProjectRisks(params.id),
  ]);

  if (!project) notFound();

  const { balance, used } = budgetData;
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
            <Badge variant="secondary">{project._count.tasks} 个子任务</Badge>
          </div>
        </div>
      </div>

      <ImportDraftPanel drafts={importDrafts} tasks={taskOptions} />

      {/* 四 Tab 布局 */}
      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="w-full justify-start rounded-lg border bg-muted/40 p-1 h-auto gap-0">
          <TabsTrigger
            value="tasks"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            📋 任务总控
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            🕐 项目活动
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            📆 执行日历
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            💰 资金账本
          </TabsTrigger>
          <TabsTrigger
            value="risks"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            ⚠️ 风险/待定
          </TabsTrigger>
          <TabsTrigger
            value="wiki"
            className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            📁 文档资产
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

        <TabsContent value="calendar" className="mt-4">
          <ExecutionCalendarView projectId={params.id} entries={calendarEntries} tasks={taskOptions} />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <LedgerTable
            totalBudget={project.totalBudget}
            balance={balance}
            used={used}
            flows={flows}
            tasks={taskOptions}
          />
        </TabsContent>

        <TabsContent value="risks" className="mt-4">
          <RiskView risks={risks} />
        </TabsContent>

        <TabsContent value="wiki" className="mt-4">
          <WikiExplorer projectId={params.id} folders={folders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
