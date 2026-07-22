"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck, CircleDollarSign, ClipboardList, Clock, Loader2, MessageSquare, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { adoptAIActionSuggestion, adoptAIBudgetSignal, generateProjectActivitySummary, scheduleAIActionSuggestion } from "@/actions/timeline-actions";
import { cn } from "@/lib/utils";

type Log = {
  id: string;
  type?: "PROGRESS" | "ACTIVITY";
  taskId: string | null;
  content: string;
  createdBy: string;
  createdAt: Date | string;
  task: { id: string; name: string; status: string } | null;
  targetId?: string | null;
  targetType?: string;
  changeType?: string;
  afterState?: unknown;
  source?: string;
};

type TaskOption = { id: string; name: string; status: string };
type ActivityFilter = "ALL" | "PROGRESS" | "CONTROL" | "BUDGET" | "CALENDAR" | "AI";
type ActivityCategory = Exclude<ActivityFilter, "ALL">;
type ActivityInsight = {
  recentCount: number;
  focusLabel: string;
  focusCount: number;
  budgetCount: number;
  latestTitle: string;
  latestContent: string;
};
type ProjectAIInsight = {
  summary: string;
  watchItems: string[];
  nextActions: string[];
  missingInfo: string[];
  budgetSignals: string[];
};
type PendingAdoption = {
  activityLogId: string;
  actionIndex: number;
  action: string;
} | null;
type PendingSchedule = {
  activityLogId: string;
  actionIndex: number;
  action: string;
} | null;
type PendingBudget = {
  activityLogId: string;
  budgetIndex: number;
  signal: string;
} | null;

interface Props { projectId: string; logs: Log[]; tasks: TaskOption[]; canEdit: boolean }

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "PROGRESS", label: "进度" },
  { value: "CONTROL", label: "管控" },
  { value: "BUDGET", label: "预算" },
  { value: "CALENDAR", label: "日历" },
  { value: "AI", label: "AI 导入" },
];

export function TimelineView({ projectId, logs, tasks, canEdit }: Props) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [adoptingAction, setAdoptingAction] = useState<string | null>(null);
  const [schedulingAction, setSchedulingAction] = useState<string | null>(null);
  const [adoptingBudget, setAdoptingBudget] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<ProjectAIInsight | null>(null);
  const [pendingAdoption, setPendingAdoption] = useState<PendingAdoption>(null);
  const [pendingSchedule, setPendingSchedule] = useState<PendingSchedule>(null);
  const [pendingBudget, setPendingBudget] = useState<PendingBudget>(null);
  const [filter, setFilter] = useState<ActivityFilter>("ALL");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const insight = useMemo(() => getActivityInsight(logs), [logs]);

  const visibleLogs = useMemo(
    () => logs.filter((log) => matchesFilter(log, filter) && matchesQuery(log, normalizedQuery)),
    [filter, logs, normalizedQuery]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape" && document.activeElement === searchRef.current && query) {
        event.preventDefault();
        setQuery("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  async function handleGenerateSummary() {
    if (!canEdit) return;
    setGeneratingSummary(true);
    try {
      const result = await generateProjectActivitySummary(projectId);
      if (result.success && result.data?.summary) {
        setAiInsight(result.data);
        toast.success("AI 项目摘要已写入活动流");
        router.refresh();
      } else {
        toast.error(result.message ?? "AI 摘要生成失败");
      }
    } catch {
      toast.error("AI 摘要生成失败，请重试");
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleAdoptAIAction(formData: FormData) {
    if (!canEdit || !pendingAdoption) return;
    const key = `${pendingAdoption.activityLogId}-${pendingAdoption.actionIndex}`;
    setAdoptingAction(key);
    try {
      formData.set("projectId", projectId);
      formData.set("activityLogId", pendingAdoption.activityLogId);
      formData.set("actionIndex", String(pendingAdoption.actionIndex));
      const result = await adoptAIActionSuggestion(formData);
      if (result.success && result.data?.taskId) {
        toast.success("已采纳为管控事项");
        setPendingAdoption(null);
        router.push(`/projects/${projectId}?tab=tasks&focusTask=${result.data.taskId}`);
      } else {
        toast.error(result.message ?? "采纳失败");
      }
    } catch {
      toast.error("采纳失败，请重试");
    } finally {
      setAdoptingAction(null);
    }
  }

  async function handleScheduleAIAction(formData: FormData) {
    if (!canEdit || !pendingSchedule) return;
    const key = `${pendingSchedule.activityLogId}-${pendingSchedule.actionIndex}`;
    setSchedulingAction(key);
    try {
      formData.set("projectId", projectId);
      formData.set("activityLogId", pendingSchedule.activityLogId);
      formData.set("actionIndex", String(pendingSchedule.actionIndex));
      const result = await scheduleAIActionSuggestion(formData);
      if (result.success && result.data?.calendarEntryId) {
        toast.success("已排入执行日历");
        setPendingSchedule(null);
        router.push(`/projects/${projectId}?tab=calendar`);
      } else {
        toast.error(result.message ?? "排期失败");
      }
    } catch {
      toast.error("排期失败，请重试");
    } finally {
      setSchedulingAction(null);
    }
  }

  async function handleAdoptAIBudget(formData: FormData) {
    if (!canEdit || !pendingBudget) return;
    const key = `${pendingBudget.activityLogId}-${pendingBudget.budgetIndex}`;
    setAdoptingBudget(key);
    try {
      formData.set("projectId", projectId);
      formData.set("activityLogId", pendingBudget.activityLogId);
      formData.set("budgetIndex", String(pendingBudget.budgetIndex));
      const result = await adoptAIBudgetSignal(formData);
      if (result.success && result.data?.budgetFlowId) {
        toast.success("已写入预算流转");
        setPendingBudget(null);
        router.push(`/projects/${projectId}?tab=ledger`);
      } else {
        toast.error(result.message ?? "预算记账失败");
      }
    } catch {
      toast.error("预算记账失败，请重试");
    } finally {
      setAdoptingBudget(null);
    }
  }

  return (
    <div className="space-y-4">
      {insight && (
        <details className="border-y border-border py-3" data-activity-insight="true">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground marker:hidden">
            <Sparkles className="size-3.5 text-primary" />
            <span>AI 简报：最近 7 天有 {insight.recentCount} 次变化，{insight.focusCount} 项集中在「{insight.focusLabel}」。</span>
            <span className="ml-auto text-xs text-primary">展开</span>
          </summary>
          <div className="pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-foreground/80">最新动作：{insight.latestTitle} · {insight.latestContent}</p>
              {canEdit && <Button type="button" size="sm" variant="ghost" onClick={handleGenerateSummary} disabled={generatingSummary} className="h-7 gap-1.5 px-2 text-xs">{generatingSummary ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}AI 提炼</Button>}
            </div>
            {aiInsight && <AIInsightPanel insight={aiInsight} />}
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-1">
          {ACTIVITY_FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            data-activity-search="true"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索活动、事项、人员或来源（/ 聚焦）"
            className="h-9 pl-8 pr-9 text-xs"
          />
          {query && (
            <button
              type="button"
              aria-label="清空活动搜索"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">显示 {visibleLogs.length} / {logs.length} 条</p>
      </div>

      {logs.length === 0 ? (
        <div className="border-y border-border py-10 text-center">
          <p className="text-sm font-medium">暂无项目变化。</p>
          <p className="mt-1 text-xs text-muted-foreground">更新管控事项、预算或执行节点后，这里会自动记录。</p>
          <Button type="button" size="sm" variant="ghost" className="mt-3 text-xs" onClick={() => router.push(`/projects/${projectId}?tab=tasks`)}>前往管控事项 <ArrowRight className="ml-1 size-3" /></Button>
        </div>
      ) : visibleLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-y border-border py-14 text-center">
          <Clock className="size-9 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">当前条件下暂无活动</p>
          <p className="text-xs text-muted-foreground/60 mt-1">调整筛选或清空搜索查看完整项目记录</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {visibleLogs.map((log) => {
              const meta = getLogMeta(log);
              const affectedTasks = getAffectedTasks(log);
              const aiLogInsight = getAIInsight(log);
              const adoptedActionIndexes = getAdoptedAIActionIndexes(log);
              const scheduledActionIndexes = getScheduledAIActionIndexes(log);
              const adoptedBudgetSignalIndexes = getAdoptedAIBudgetSignalIndexes(log);
              const overflowCount = Math.max(affectedTasks.length - 5, 0);

              return (
                <div key={log.id} className="relative flex gap-4 pl-11">
                  <div className={cn("absolute left-4 mt-1.5 flex size-5 -translate-x-1/2 items-center justify-center rounded-full border bg-background", meta.dotClass)}>
                    <meta.Icon className="size-3" />
                  </div>
                  <div className="flex-1 space-y-1.5 border-b border-border pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {meta.title}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(log.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                    {aiLogInsight && (
                      <AIInsightPanel
                        insight={aiLogInsight}
                        compact
                        adoptedActionIndexes={adoptedActionIndexes}
                        scheduledActionIndexes={scheduledActionIndexes}
                        adoptedBudgetSignalIndexes={adoptedBudgetSignalIndexes}
                        adoptingKey={adoptingAction}
                        schedulingKey={schedulingAction}
                        adoptingBudgetKey={adoptingBudget}
                        activityLogId={log.id}
                        onAdopt={canEdit ? (activityLogId, actionIndex, action) => setPendingAdoption({ activityLogId, actionIndex, action }) : undefined}
                        onSchedule={canEdit ? (activityLogId, actionIndex, action) => setPendingSchedule({ activityLogId, actionIndex, action }) : undefined}
                        onAdoptBudget={canEdit ? (activityLogId, budgetIndex, signal) => setPendingBudget({ activityLogId, budgetIndex, signal }) : undefined}
                      />
                    )}
                    {affectedTasks.length > 1 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {affectedTasks.slice(0, 5).map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => router.push(`/projects/${projectId}?tab=tasks&focusTask=${task.id}`)}
                            className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                          >
                            {task.name}
                          </button>
                        ))}
                        {overflowCount > 0 && (
                          <span className="text-muted-foreground">
                            另 {overflowCount} 条
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">— {log.createdBy}</p>
                      {log.targetType === "CONTROL_ITEM" && log.targetId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => router.push(`/projects/${projectId}?tab=tasks&focusTask=${log.targetId}`)}
                        >
                          查看事项
                          <ArrowRight className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={Boolean(pendingAdoption)} onOpenChange={(nextOpen) => !nextOpen && setPendingAdoption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>采纳 AI 行动建议</DialogTitle>
          </DialogHeader>
          <form action={handleAdoptAIAction} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">事项名称</label>
              <Input name="name" defaultValue={pendingAdoption?.action ?? ""} required className="h-9" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">负责人</label>
                <Input name="assignee" placeholder="可留空" className="h-9" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">部门</label>
                <Input name="department" placeholder="可留空" className="h-9" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">截止日期</label>
              <Input name="deadline" inputMode="numeric" placeholder="YYYY-MM-DD，可留空" className="h-9" />
            </div>
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              采纳后会创建一条 P1 管控事项，并在活动流保留 AI 原建议与采纳记录。
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPendingAdoption(null)}>
                取消
              </Button>
              <Button type="submit" disabled={Boolean(adoptingAction)} className="gap-1.5">
                {adoptingAction && <Loader2 className="size-3.5 animate-spin" />}
                创建管控事项
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingSchedule)} onOpenChange={(nextOpen) => !nextOpen && setPendingSchedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>排入执行日历</DialogTitle>
          </DialogHeader>
          <form action={handleScheduleAIAction} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">日历内容</label>
              <Input name="content" defaultValue={pendingSchedule?.action ?? ""} required className="h-9" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">关联管控事项</label>
              <Select name="taskId">
                <option value="">不关联</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">日期</label>
                <Input name="date" inputMode="numeric" placeholder="YYYY-MM-DD" className="h-9" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">开始</label>
                <Input name="startTime" placeholder="HH:mm" className="h-9" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">结束</label>
                <Input name="endTime" placeholder="HH:mm" className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">模块/执行线</label>
                <Input name="workstream" placeholder="如传播/执行/发布" className="h-9" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">渠道</label>
                <Input name="channel" placeholder="如视频号/新闻稿/线下" className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">负责人</label>
                <Input name="owner" placeholder="可留空" className="h-9" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">部门</label>
                <Input name="department" placeholder="可留空" className="h-9" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">备注</label>
              <Input name="notes" placeholder="可留空" className="h-9" />
            </div>
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              排期后会创建执行日历项，并在活动流保留 AI 原建议与排期记录。日期留空时进入待排期。
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPendingSchedule(null)}>
                取消
              </Button>
              <Button type="submit" disabled={Boolean(schedulingAction)} className="gap-1.5">
                {schedulingAction && <Loader2 className="size-3.5 animate-spin" />}
                创建日历项
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingBudget)} onOpenChange={(nextOpen) => !nextOpen && setPendingBudget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认 AI 预算信号</DialogTitle>
          </DialogHeader>
          <form action={handleAdoptAIBudget} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">关联管控事项</label>
              <Select name="taskId" required>
                <option value="">请选择事项</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">流水类型</label>
                <Select name="flowType" defaultValue="EXPENSE">
                  <option value="ALLOCATE">分配</option>
                  <option value="EXPENSE">支出</option>
                  <option value="REFUND">退款</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">金额</label>
                <Input name="amount" type="number" min="0" step="0.01" required placeholder="输入正数" className="h-9" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">事由</label>
              <Input name="description" defaultValue={pendingBudget?.signal ?? ""} required className="h-9" />
            </div>
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              确认后会写入预算流转；支出会自动记为负数，并在活动流保留 AI 原预算信号。
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPendingBudget(null)}>
                取消
              </Button>
              <Button type="submit" disabled={Boolean(adoptingBudget)} className="gap-1.5">
                {adoptingBudget && <Loader2 className="size-3.5 animate-spin" />}
                写入预算流转
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AIInsightPanel({
  insight,
  compact = false,
  adoptedActionIndexes = [],
  scheduledActionIndexes = [],
  adoptedBudgetSignalIndexes = [],
  adoptingKey,
  schedulingKey,
  adoptingBudgetKey,
  activityLogId,
  onAdopt,
  onSchedule,
  onAdoptBudget,
}: {
  insight: ProjectAIInsight;
  compact?: boolean;
  adoptedActionIndexes?: number[];
  scheduledActionIndexes?: number[];
  adoptedBudgetSignalIndexes?: number[];
  adoptingKey?: string | null;
  schedulingKey?: string | null;
  adoptingBudgetKey?: string | null;
  activityLogId?: string;
  onAdopt?: (activityLogId: string, actionIndex: number, action: string) => void;
  onSchedule?: (activityLogId: string, actionIndex: number, action: string) => void;
  onAdoptBudget?: (activityLogId: string, budgetIndex: number, signal: string) => void;
}) {
  const sections = [
    { label: "下一步", items: insight.nextActions },
    { label: "待确认", items: insight.watchItems },
    { label: "缺失", items: insight.missingInfo },
    { label: "预算", items: insight.budgetSignals },
  ].filter((section) => section.items.length > 0);

  return (
    <div className={cn("rounded-md border bg-background px-3 py-2", compact ? "space-y-2" : "mt-2 space-y-2")} data-ai-activity-summary="true">
      {!compact && (
        <p className="text-sm leading-6 text-foreground/85">{insight.summary}</p>
      )}
      {sections.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item, index) => {
                  const isNextAction = section.label === "下一步";
                  const isBudget = section.label === "预算";
                  const actionIndex = isNextAction ? index : -1;
                  const budgetIndex = isBudget ? index : -1;
                  const isAdopted = isNextAction && adoptedActionIndexes.includes(actionIndex);
                  const isScheduled = isNextAction && scheduledActionIndexes.includes(actionIndex);
                  const isBudgetAdopted = isBudget && adoptedBudgetSignalIndexes.includes(budgetIndex);
                  const key = activityLogId ? `${activityLogId}-${actionIndex}` : null;
                  const budgetKey = activityLogId ? `${activityLogId}-${budgetIndex}` : null;
                  const canAdopt = isNextAction && activityLogId && onAdopt && actionIndex >= 0;
                  const canSchedule = isNextAction && activityLogId && onSchedule && actionIndex >= 0;
                  const canAdoptBudget = isBudget && activityLogId && onAdoptBudget && budgetIndex >= 0;

                  return (
                    <div key={`${section.label}-${index}-${item}`} className="flex flex-wrap items-center gap-1 rounded bg-muted/40 px-2 py-1">
                      <p className="min-w-0 flex-1 text-xs leading-5 text-foreground/80">{item}</p>
                      {canAdopt && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isAdopted ? "secondary" : "ghost"}
                          disabled={isAdopted || adoptingKey === key}
                          onClick={() => onAdopt(activityLogId, actionIndex, item)}
                          className="h-6 shrink-0 px-2 text-[11px]"
                        >
                          {adoptingKey === key ? <Loader2 className="size-3 animate-spin" /> : isAdopted ? "已采纳" : "采纳"}
                        </Button>
                      )}
                      {canSchedule && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isScheduled ? "secondary" : "ghost"}
                          disabled={isScheduled || schedulingKey === key}
                          onClick={() => onSchedule(activityLogId, actionIndex, item)}
                          className="h-6 shrink-0 px-2 text-[11px]"
                        >
                          {schedulingKey === key ? <Loader2 className="size-3 animate-spin" /> : isScheduled ? "已排期" : "排期"}
                        </Button>
                      )}
                      {canAdoptBudget && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isBudgetAdopted ? "secondary" : "ghost"}
                          disabled={isBudgetAdopted || adoptingBudgetKey === budgetKey}
                          onClick={() => onAdoptBudget(activityLogId, budgetIndex, item)}
                          className="h-6 shrink-0 px-2 text-[11px]"
                        >
                          {adoptingBudgetKey === budgetKey ? <Loader2 className="size-3 animate-spin" /> : isBudgetAdopted ? "已记账" : "记账"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function matchesFilter(log: Log, filter: ActivityFilter) {
  if (filter === "ALL") return true;
  if (filter === "PROGRESS") return log.type === "PROGRESS";
  if (filter === "CONTROL") return log.targetType === "CONTROL_ITEM";
  if (filter === "BUDGET") return log.targetType === "BUDGET_ITEM";
  if (filter === "CALENDAR") return log.targetType === "CALENDAR_ENTRY";
  if (filter === "AI") return log.source === "IMPORT" || log.source === "AI";
  return true;
}

function getActivityInsight(logs: Log[]): ActivityInsight | null {
  if (logs.length === 0) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const recentLogs = logs.filter((log) => {
    const createdAt = new Date(log.createdAt);
    return Number.isFinite(createdAt.getTime()) && createdAt >= sevenDaysAgo;
  });
  const scopedLogs = recentLogs.length > 0 ? recentLogs : logs.slice(0, Math.min(logs.length, 10));
  const categoryCounts = scopedLogs.reduce<Record<ActivityCategory, number>>((counts, log) => {
    counts[getActivityCategory(log)] += 1;
    return counts;
  }, {
    PROGRESS: 0,
    CONTROL: 0,
    BUDGET: 0,
    CALENDAR: 0,
    AI: 0,
  });
  const focus = (Object.entries(categoryCounts) as [ActivityCategory, number][])
    .sort((a, b) => b[1] - a[1])[0] ?? ["PROGRESS", 0];
  const latestLog = logs[0];
  const latestMeta = getLogMeta(latestLog);

  return {
    recentCount: recentLogs.length,
    focusLabel: activityCategoryLabel(focus[0]),
    focusCount: focus[1],
    budgetCount: categoryCounts.BUDGET,
    latestTitle: latestMeta.title,
    latestContent: compactText(latestLog.content, 80),
  };
}

function getActivityCategory(log: Log): ActivityCategory {
  if (log.targetType === "CONTROL_ITEM") return "CONTROL";
  if (log.targetType === "BUDGET_ITEM") return "BUDGET";
  if (log.targetType === "CALENDAR_ENTRY") return "CALENDAR";
  if (log.source === "IMPORT" || log.source === "AI") return "AI";
  return "PROGRESS";
}

function activityCategoryLabel(category: ActivityCategory) {
  const map: Record<ActivityCategory, string> = {
    PROGRESS: "进度",
    CONTROL: "管控",
    BUDGET: "预算",
    CALENDAR: "日历",
    AI: "AI 导入",
  };

  return map[category];
}

function compactText(content: string, maxLength: number) {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function matchesQuery(log: Log, query: string) {
  if (!query) return true;
  const meta = getLogMeta(log);
  const affectedTasks = getAffectedTasks(log).map((task) => task.name).join(" ");
  const aiInsight = getAIInsight(log);
  const haystack = [
    log.content,
    log.createdBy,
    log.task?.name,
    log.task?.status,
    log.targetType,
    log.changeType,
    log.source,
    meta.title,
    meta.badge,
    sourceLabel(log.source ?? ""),
    affectedTasks,
    aiInsight?.summary,
    aiInsight?.watchItems.join(" "),
    aiInsight?.nextActions.join(" "),
    aiInsight?.missingInfo.join(" "),
    aiInsight?.budgetSignals.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getLogMeta(log: Log) {
  if (log.task) {
    return {
      title: log.task.name,
      badge: TASK_STATUS_MAP[log.task.status as keyof typeof TASK_STATUS_MAP] ?? log.task.status,
      Icon: MessageSquare,
      dotClass: "border-primary/30 text-primary",
    };
  }

  if (log.targetType === "BUDGET_ITEM") {
    return {
      title: "预算流转",
      badge: changeTypeLabel(log.changeType),
      Icon: CircleDollarSign,
      dotClass: "border-success/30 text-success",
    };
  }

  if (log.targetType === "CONTROL_ITEM") {
    return {
      title: "管控表更新",
      badge: changeTypeLabel(log.changeType),
      Icon: ClipboardList,
      dotClass: "border-primary/30 text-primary",
    };
  }

  if (log.targetType === "CALENDAR_ENTRY") {
    return {
      title: "执行日历",
      badge: changeTypeLabel(log.changeType),
      Icon: CalendarCheck,
      dotClass: "border-info/30 text-info",
    };
  }

  if (log.targetType === "RISK") {
    return {
      title: "待确认记录",
      badge: changeTypeLabel(log.changeType),
      Icon: ClipboardList,
      dotClass: "border-warning/30 text-warning",
    };
  }

  if (log.targetType === "PROJECT" && log.changeType === "AI_ACTION") {
    return {
      title: "AI 项目判断",
      badge: changeTypeLabel(log.changeType),
      Icon: Sparkles,
      dotClass: "border-primary/30 text-primary",
    };
  }

  return {
    title: "项目活动",
    badge: changeTypeLabel(log.changeType),
    Icon: Sparkles,
    dotClass: "border-border text-muted-foreground",
  };
}

function getAffectedTasks(log: Log) {
  if (!log.afterState || typeof log.afterState !== "object") return [];
  const affectedTasks = (log.afterState as { affectedTasks?: unknown }).affectedTasks;
  if (!Array.isArray(affectedTasks)) return [];

  return affectedTasks.filter((task): task is { id: string; name: string } => {
    if (!task || typeof task !== "object") return false;
    const candidate = task as { id?: unknown; name?: unknown };
    return typeof candidate.id === "string" && typeof candidate.name === "string";
  });
}

function getAIInsight(log: Log): ProjectAIInsight | null {
  if (log.targetType !== "PROJECT" || log.changeType !== "AI_ACTION") return null;
  if (!log.afterState || typeof log.afterState !== "object") return null;
  const state = log.afterState as Partial<ProjectAIInsight>;
  if (typeof state.summary !== "string") return null;

  return {
    summary: state.summary,
    watchItems: normalizeStringList((state as { risks?: unknown; watchItems?: unknown }).watchItems ?? (state as { risks?: unknown }).risks),
    nextActions: normalizeStringList(state.nextActions),
    missingInfo: normalizeStringList(state.missingInfo),
    budgetSignals: normalizeStringList(state.budgetSignals),
  };
}

function getAdoptedAIActionIndexes(log: Log) {
  if (log.targetType !== "PROJECT" || log.changeType !== "AI_ACTION") return [];
  if (!log.afterState || typeof log.afterState !== "object") return [];
  const adoptedActionIndexes = (log.afterState as { adoptedActionIndexes?: unknown }).adoptedActionIndexes;
  if (!Array.isArray(adoptedActionIndexes)) return [];
  return adoptedActionIndexes.filter((item): item is number => Number.isInteger(item));
}

function getScheduledAIActionIndexes(log: Log) {
  if (log.targetType !== "PROJECT" || log.changeType !== "AI_ACTION") return [];
  if (!log.afterState || typeof log.afterState !== "object") return [];
  const scheduledActionIndexes = (log.afterState as { scheduledActionIndexes?: unknown }).scheduledActionIndexes;
  if (!Array.isArray(scheduledActionIndexes)) return [];
  return scheduledActionIndexes.filter((item): item is number => Number.isInteger(item));
}

function getAdoptedAIBudgetSignalIndexes(log: Log) {
  if (log.targetType !== "PROJECT" || log.changeType !== "AI_ACTION") return [];
  if (!log.afterState || typeof log.afterState !== "object") return [];
  const adoptedBudgetSignalIndexes = (log.afterState as { adoptedBudgetSignalIndexes?: unknown }).adoptedBudgetSignalIndexes;
  if (!Array.isArray(adoptedBudgetSignalIndexes)) return [];
  return adoptedBudgetSignalIndexes.filter((item): item is number => Number.isInteger(item));
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function changeTypeLabel(changeType?: string) {
  const map: Record<string, string> = {
    COMMENT: "进度",
    IMPORT: "导入确认",
    STATUS_CHANGE: "状态变更",
    BULK_UPDATE: "批量补齐",
    AI_ACTION: "AI 判断",
  };

  return changeType ? map[changeType] ?? changeType : "活动";
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    HUMAN: "人工",
    IMPORT: "AI 导入",
    AI: "AI",
  };

  return map[source] ?? source;
}
