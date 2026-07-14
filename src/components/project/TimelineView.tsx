"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck, CircleDollarSign, ClipboardList, Clock, Loader2, MessageSquare, Plus, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { addProgressLog, adoptAIActionSuggestion, adoptAIBudgetSignal, generateProjectActivitySummary, scheduleAIActionSuggestion } from "@/actions/timeline-actions";
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

const ACTIVITY_BLUEPRINTS = [
  {
    title: "管控变更",
    description: "负责人、部门、截止日期与批量补齐",
    Icon: ClipboardList,
    className: "border-primary/30 bg-primary/[0.06] text-primary",
  },
  {
    title: "人工进度",
    description: "关键进展、阻塞、结论和下一步",
    Icon: MessageSquare,
    className: "border-info/30 bg-info/[0.06] text-info",
  },
  {
    title: "预算流转",
    description: "预算分配、支出、退款和余额变化",
    Icon: CircleDollarSign,
    className: "border-success/30 bg-success/[0.06] text-success",
  },
  {
    title: "执行日历",
    description: "传播排期、渠道动作和执行状态",
    Icon: CalendarCheck,
    className: "border-primary/25 bg-primary/[0.05] text-primary",
  },
  {
    title: "AI 导入",
    description: "表格识别、直接入表和可追溯修正",
    Icon: Sparkles,
    className: "border-border bg-secondary text-muted-foreground",
  },
];

export function TimelineView({ projectId, logs, tasks, canEdit }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const filterCounts = useMemo(() => {
    return ACTIVITY_FILTERS.reduce<Record<ActivityFilter, number>>((counts, item) => {
      counts[item.value] = logs.filter((log) => matchesFilter(log, item.value)).length;
      return counts;
    }, {
      ALL: 0,
      PROGRESS: 0,
      CONTROL: 0,
      BUDGET: 0,
      CALENDAR: 0,
      AI: 0,
    });
  }, [logs]);

  const insight = useMemo(() => getActivityInsight(logs), [logs]);

  const visibleLogs = useMemo(
    () => logs.filter((log) => matchesFilter(log, filter) && matchesQuery(log, normalizedQuery)),
    [filter, logs, normalizedQuery]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;

      if (event.key === "/" && !isTyping && !open) {
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
  }, [open, query]);

  async function handleSubmit(formData: FormData) {
    if (!canEdit) return;
    setSubmitting(true);
    try {
      const result = await addProgressLog(formData);
      if (result.success) {
        toast.success(result.message!);
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">项目活动流</h2>
          <p className="text-sm text-muted-foreground">
            共 {logs.length} 条记录，包含人工进度、预算流转、执行日历与 AI 导入确认
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />追加进度
          </Button>
        ) : (
          <Badge variant="outline">只读活动流</Badge>
        )}
      </div>

      {insight && (
        <div className="rounded-lg border bg-muted/20 p-3" data-activity-insight="true">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[260px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  <p className="text-sm font-medium">项目状态摘要</p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    {generatingSummary ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    AI 提炼
                  </Button>
                )}
              </div>
              {aiInsight && (
                <AIInsightPanel insight={aiInsight} />
              )}
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground/80">
                最近 7 天有 {insight.recentCount} 条活动，主要变化集中在「{insight.focusLabel}」。
                {insight.budgetCount > 0 ? ` 预算流转 ${insight.budgetCount} 条，建议和预算页交叉核对。` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                最新动作：{insight.latestTitle} · {insight.latestContent}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4">
              <InsightMetric label="7 天活动" value={insight.recentCount} />
              <InsightMetric label={insight.focusLabel} value={insight.focusCount} />
              <InsightMetric label="预算" value={insight.budgetCount} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ACTIVITY_FILTERS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            <span className={cn(
              "rounded-full px-1.5 text-[10px]",
              filter === item.value ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
            )}>
              {filterCounts[item.value]}
            </span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            data-activity-search="true"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索活动、事项、人员或来源（/ 聚焦）"
            className="h-9 rounded-full pl-8 pr-9 text-xs"
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
        <p className="text-xs text-muted-foreground">
          显示 {visibleLogs.length} / {logs.length} 条
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">暂无项目活动</p>
              <p className="mt-1 text-xs text-muted-foreground">
                后续关键动作会自动沉淀为项目记忆，先从人工进度或管控表补齐开始。
              </p>
            </div>
            <Clock className="size-9 text-muted-foreground/25" />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ACTIVITY_BLUEPRINTS.map((item) => (
              <div key={item.title} className="rounded-md border bg-background p-3">
                <div className="flex items-start gap-2">
                  <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border", item.className)}>
                    <item.Icon className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : visibleLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14 text-center">
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
                  <div className="flex-1 space-y-1.5 rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {meta.title}
                      </span>
                      <Badge variant={log.type === "ACTIVITY" ? "secondary" : "outline"} className="text-[10px] h-4 px-1.5">
                        {meta.badge}
                      </Badge>
                      {log.source && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                          {sourceLabel(log.source)}
                        </Badge>
                      )}
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
                      <div className="flex flex-wrap gap-1.5 rounded-md bg-muted/30 p-2">
                        {affectedTasks.slice(0, 5).map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => router.push(`/projects/${projectId}?tab=tasks&focusTask=${task.id}`)}
                            className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                          >
                            {task.name}
                          </button>
                        ))}
                        {overflowCount > 0 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>追加进度记录</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                所属管控事项 <span className="text-red-500">*</span>
              </label>
              <select name="taskId" required className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background">
                <option value="">请选择管控事项</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} [{TASK_STATUS_MAP[t.status as keyof typeof TASK_STATUS_MAP] ?? t.status}]</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                汇报内容 <span className="text-red-500">*</span>
              </label>
              <textarea name="content" required rows={4} placeholder="例如：新闻通稿 V1 已交付，等待客户反馈。" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                追加记录
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
              <select name="taskId" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none">
                <option value="">不关联</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </select>
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
              <select name="taskId" required className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none">
                <option value="">请选择事项</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">流水类型</label>
                <select name="flowType" defaultValue="EXPENSE" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none">
                  <option value="ALLOCATE">分配</option>
                  <option value="EXPENSE">支出</option>
                  <option value="REFUND">退款</option>
                </select>
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

function InsightMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-16 rounded-md border bg-background px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
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
      dotClass: "border-blue-300 text-blue-600",
    };
  }

  if (log.targetType === "BUDGET_ITEM") {
    return {
      title: "预算流转",
      badge: changeTypeLabel(log.changeType),
      Icon: CircleDollarSign,
      dotClass: "border-emerald-300 text-emerald-600",
    };
  }

  if (log.targetType === "CONTROL_ITEM") {
    return {
      title: "管控表更新",
      badge: changeTypeLabel(log.changeType),
      Icon: ClipboardList,
      dotClass: "border-sky-300 text-sky-600",
    };
  }

  if (log.targetType === "CALENDAR_ENTRY") {
    return {
      title: "执行日历",
      badge: changeTypeLabel(log.changeType),
      Icon: CalendarCheck,
      dotClass: "border-violet-300 text-violet-600",
    };
  }

  if (log.targetType === "RISK") {
    return {
      title: "待确认记录",
      badge: changeTypeLabel(log.changeType),
      Icon: ClipboardList,
      dotClass: "border-sky-300 text-sky-600",
    };
  }

  if (log.targetType === "PROJECT" && log.changeType === "AI_ACTION") {
    return {
      title: "AI 项目判断",
      badge: changeTypeLabel(log.changeType),
      Icon: Sparkles,
      dotClass: "border-gray-300 text-primary",
    };
  }

  return {
    title: "项目活动",
    badge: changeTypeLabel(log.changeType),
    Icon: Sparkles,
    dotClass: "border-gray-300 text-gray-600",
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
