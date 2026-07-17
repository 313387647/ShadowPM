import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getProjectDetail } from "@/actions/project-actions";
import { getProjectTasks } from "@/actions/task-actions";
import { getProjectBudgetPlanning, getProjectBudgetTaskOptions } from "@/actions/budget-queries";
import { getProjectTimeline } from "@/actions/timeline-actions";
import { getProjectPhases } from "@/actions/phase-actions";
import { getProjectCalendarEntries } from "@/actions/calendar-actions";
import { getProjectOutputs } from "@/actions/project-output-actions";
import { BudgetWorkspace } from "@/components/project/budget/BudgetWorkspace";
import { TimelineView } from "@/components/project/TimelineView";
import { TaskViewToggle } from "@/components/project/TaskViewToggle";
import { ExecutionCalendarView } from "@/components/project/ExecutionCalendarView";
import { ProjectOutputsPanel } from "@/components/project/ProjectOutputsPanel";
import { ProjectManageActions } from "@/components/project/ProjectManageActions";
import { getProjectLifecycle, PROJECT_LIFECYCLE_LABEL } from "@/lib/project-lifecycle";

type ProjectTab = "tasks" | "ledger" | "calendar" | "timeline";
const TABS: Array<{ value: ProjectTab; label: string }> = [
  { value: "tasks", label: "管控事项" },
  { value: "ledger", label: "预算" },
  { value: "calendar", label: "执行日历" },
  { value: "timeline", label: "变更记录" },
];

export default async function ProjectDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { tab?: string } }) {
  const project = await getProjectDetail(params.id);
  if (!project) notFound();
  const activeTab = isProjectTab(searchParams?.tab) ? searchParams!.tab : "tasks";
  const lifecycle = getProjectLifecycle({ startDate: project.startDate, taskStatuses: project.tasks.map((task) => task.status) });
  const now = new Date();
  const openCount = project.tasks.filter((task) => task.status !== "COMPLETED").length;
  const overdueCount = project.tasks.filter((task) => task.status !== "COMPLETED" && task.deadline && task.deadline < now).length;
  const nextNode = project.calendarEntries[0] ?? null;
  const budgetLabel = project.budgetSummary.mode === "NOT_MANAGED" ? "未启用预算" : project.budgetSummary.mode !== "CONFIRMED" ? "预算待确认" : `¥${project.budgetSummary.spendRemaining.toLocaleString("zh-CN")}`;
  const outputs = await getProjectOutputs(params.id);

  return <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6 lg:p-7">
    <header className="border-b border-border pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link href="/projects" className="hover:text-foreground">项目</Link><span>/</span><span className="truncate">{project.name}</span></div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1><Badge variant="outline" className={project.archivedAt ? "border-muted-foreground/30 bg-muted text-muted-foreground" : lifecycle === "COMPLETED" ? "border-success/25 bg-success/10 text-success" : lifecycle === "UPCOMING" ? "border-warning/25 bg-warning/10 text-warning" : "border-primary/25 bg-primary/10 text-primary"}>{project.archivedAt ? "已归档" : PROJECT_LIFECYCLE_LABEL[lifecycle]}</Badge>{!project.canEdit && <Badge variant="outline" className="gap-1"><Eye className="size-3" />只读</Badge>}</div>
          <p className="mt-2 text-sm text-muted-foreground">负责人 {project.owner.name} · {formatProjectPeriod(project.startDate, project.endDate)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><ProjectOutputsPanel projectId={params.id} canEdit={project.canEdit} data={outputs} /><ProjectManageActions project={{ id: project.id, name: project.name, startDate: project.startDate, endDate: project.endDate, archivedAt: project.archivedAt }} canEdit={project.canEdit} canManage={project.canManage} /></div>
      </div>
      <section className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm" aria-label="项目脉搏"><PulseMetric label="待处理" value={openCount} /><PulseMetric label="已逾期" value={overdueCount} danger={overdueCount > 0} /><PulseMetric label="下一节点" value={nextNode?.date ? `${formatDate(nextNode.date)} ${nextNode.content}` : "待排期"} /><PulseMetric label={project.budgetSummary.mode === "CONFIRMED" ? "剩余预算" : "预算状态"} value={budgetLabel} /></section>
    </header>

    <nav className="sticky top-16 z-20 flex overflow-x-auto border-b border-border bg-canvas/95 backdrop-blur" aria-label="项目模块">{TABS.map((tab) => <Link key={tab.value} href={tab.value === "tasks" ? `/projects/${params.id}` : `/projects/${params.id}?tab=${tab.value}`} className={activeTab === tab.value ? "shrink-0 border-b-2 border-primary px-3 py-3 text-sm font-medium text-foreground" : "shrink-0 border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"}>{tab.label}</Link>)}</nav>

    {activeTab === "tasks" && <TasksSurface projectId={params.id} canEdit={project.canEdit} viewerName={project.viewerName} />}
    {activeTab === "ledger" && <BudgetSurface projectId={params.id} canEdit={project.canEdit} canManage={project.canManage} />}
    {activeTab === "calendar" && <CalendarSurface projectId={params.id} canEdit={project.canEdit} />}
    {activeTab === "timeline" && <TimelineSurface projectId={params.id} canEdit={project.canEdit} />}
  </div>;
}

async function TasksSurface({ projectId, canEdit, viewerName }: { projectId: string; canEdit: boolean; viewerName: string }) { const [tasks, phases] = await Promise.all([getProjectTasks(projectId), getProjectPhases(projectId)]); return <TaskViewToggle projectId={projectId} tasks={tasks} phases={phases} canEdit={canEdit} viewerName={viewerName} />; }
async function BudgetSurface({ projectId, canEdit, canManage }: { projectId: string; canEdit: boolean; canManage: boolean }) { const [data, tasks] = await Promise.all([getProjectBudgetPlanning(projectId), getProjectBudgetTaskOptions(projectId)]); if (!data) notFound(); return <BudgetWorkspace data={data} tasks={tasks} canEdit={canEdit} canManage={canManage} />; }
async function CalendarSurface({ projectId, canEdit }: { projectId: string; canEdit: boolean }) { const [entries, tasks] = await Promise.all([getProjectCalendarEntries(projectId), getProjectBudgetTaskOptions(projectId)]); return <ExecutionCalendarView projectId={projectId} entries={entries} tasks={tasks} canEdit={canEdit} />; }
async function TimelineSurface({ projectId, canEdit }: { projectId: string; canEdit: boolean }) { const [logs, tasks] = await Promise.all([getProjectTimeline(projectId), getProjectBudgetTaskOptions(projectId)]); return <TimelineView projectId={projectId} logs={logs} tasks={tasks} canEdit={canEdit} />; }
function PulseMetric({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) { return <p className="flex min-w-0 items-baseline gap-2"><span className="text-xs text-muted-foreground">{label}</span><span className={danger ? "truncate font-medium tabular-nums text-destructive" : "truncate font-medium tabular-nums"}>{value}</span></p>; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(value); }
function formatProjectPeriod(startDate: Date | null, endDate: Date | null) { const format = (value: Date | null) => value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value) : "未定"; return `${format(startDate)} 至 ${format(endDate)}`; }
function isProjectTab(value: string | undefined): value is ProjectTab { return value === "tasks" || value === "ledger" || value === "calendar" || value === "timeline"; }
