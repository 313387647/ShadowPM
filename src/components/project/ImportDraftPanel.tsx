"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronUp, Loader2, ShieldAlert, Sparkles, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  applyBudgetImportCandidate,
  applyCalendarImportCandidate,
  applyRiskImportCandidate,
} from "@/actions/import-draft-actions";
import { Button } from "@/components/ui/button";

type BudgetPreview = {
  candidateIndex: number;
  title?: string;
  amount?: number | null;
  type?: string | null;
  workstream?: string | null;
  status?: string | null;
  description?: string | null;
  relatedItemName?: string | null;
};

type CalendarPreview = {
  candidateIndex: number;
  date?: string | null;
  startTime?: string | null;
  channel?: string | null;
  content?: string;
  workstream?: string | null;
  status?: string | null;
};

type RiskPreview = {
  candidateIndex: number;
  title?: string;
  level?: string | null;
  description?: string | null;
  type?: string | null;
};

type ImportDraftSummary = {
  id: string;
  sourceQuality: string;
  confidence: string;
  budgetCount: number;
  calendarCount: number;
  riskCount: number;
  budgetPreview: BudgetPreview[];
  calendarPreview: CalendarPreview[];
  riskPreview: RiskPreview[];
  createdBy: string;
  createdAt: Date | string;
};

type TaskOption = {
  id: string;
  name: string;
  status: string;
};

const QUALITY_LABEL: Record<string, string> = {
  clean: "结构清晰",
  usable: "可用",
  messy: "结构混乱",
  unsafe: "需人工确认",
};

const FLOW_TYPE_LABEL: Record<string, string> = {
  ALLOCATE: "分配",
  EXPENSE: "支出",
  REFUND: "退款",
};

function normalizeBudgetType(type?: string | null) {
  return type?.trim().toUpperCase() ?? "";
}

function recommendedFlowType(item: BudgetPreview) {
  const type = normalizeBudgetType(item.type);
  if (type === "ALLOCATE") return "ALLOCATE";
  if (type === "EXPENSE") return "EXPENSE";
  if (type === "REFUND") return "REFUND";
  return "";
}

function needsManualFlowType(item: BudgetPreview) {
  const type = normalizeBudgetType(item.type);
  return !["ALLOCATE", "EXPENSE", "REFUND"].includes(type);
}

export function ImportDraftPanel({
  drafts,
  tasks,
}: {
  drafts: ImportDraftSummary[];
  tasks: TaskOption[];
}) {
  const router = useRouter();
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? null,
    [activeDraftId, drafts]
  );

  if (!activeDraft) return null;

  const totalBudget = drafts.reduce((sum, draft) => sum + draft.budgetCount, 0);
  const totalCalendar = drafts.reduce((sum, draft) => sum + draft.calendarCount, 0);
  const totalRisks = drafts.reduce((sum, draft) => sum + draft.riskCount, 0);
  const pendingBudgetPreview = activeDraft.budgetPreview;
  const pendingCalendarPreview = activeDraft.calendarPreview;
  const pendingRiskPreview = activeDraft.riskPreview;
  const pendingTotal = pendingBudgetPreview.length + pendingCalendarPreview.length + pendingRiskPreview.length;
  const expanded = manualExpanded ?? pendingTotal <= 6;

  async function handleApplyBudget(formData: FormData) {
    const key = `${formData.get("draftId")}:${formData.get("candidateIndex")}`;
    setApplyingKey(key);
    try {
      const result = await applyBudgetImportCandidate(formData);
      if (result.success) {
        toast.success("预算候选已确认入账");
        router.refresh();
      } else {
        toast.error(result.message ?? "入账失败");
      }
    } catch {
      toast.error("入账失败");
    } finally {
      setApplyingKey(null);
    }
  }

  async function handleApplyCalendar(formData: FormData) {
    const key = `calendar:${formData.get("draftId")}:${formData.get("candidateIndex")}`;
    setApplyingKey(key);
    try {
      const result = await applyCalendarImportCandidate(formData);
      if (result.success) {
        toast.success("日历候选已确认");
        router.refresh();
      } else {
        toast.error(result.message ?? "确认失败");
      }
    } catch {
      toast.error("确认失败");
    } finally {
      setApplyingKey(null);
    }
  }

  async function handleApplyRisk(formData: FormData) {
    const key = `risk:${formData.get("draftId")}:${formData.get("candidateIndex")}`;
    setApplyingKey(key);
    try {
      const result = await applyRiskImportCandidate(formData);
      if (result.success) {
        toast.success("风险候选已确认");
        router.refresh();
      } else {
        toast.error(result.message ?? "确认失败");
      }
    } catch {
      toast.error("确认失败");
    } finally {
      setApplyingKey(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">AI 导入审核队列</p>
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium">
                {QUALITY_LABEL[activeDraft.sourceQuality] ?? activeDraft.sourceQuality}
              </span>
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium">
                置信度 {activeDraft.confidence}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
              当前批次 {pendingTotal} 条，全部批次共 {totalBudget + totalCalendar + totalRisks} 条待处理。
              确认后才会写入正式预算账本、执行日历或风险列表。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
            <QueueStat icon={<WalletCards className="size-3" />} label="预算" value={totalBudget} />
            <QueueStat icon={<CalendarDays className="size-3" />} label="日历" value={totalCalendar} />
            <QueueStat icon={<ShieldAlert className="size-3" />} label="风险" value={totalRisks} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-amber-300 bg-background/70 px-2 text-xs text-amber-900 hover:bg-background"
            onClick={() => setManualExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? "收起队列" : "展开队列"}
          </Button>
        </div>
      </div>

      {!expanded && pendingTotal > 0 && (
        <div className="rounded-md border border-amber-200 bg-background/70 px-3 py-2 text-xs text-amber-900">
          队列已折叠：{pendingBudgetPreview.length} 条预算、{pendingCalendarPreview.length} 条日历、{pendingRiskPreview.length} 条风险待确认。展开后可逐条写入正式表。
        </div>
      )}

      {expanded && tasks.length === 0 && pendingBudgetPreview.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-background/70 px-3 py-2 text-xs text-amber-900">
          预算候选需要先关联管控事项。当前项目没有可选事项，预算入账会暂时不可用。
        </div>
      )}

      {expanded && drafts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-background/70 px-3 py-2">
          <span className="text-xs font-medium text-amber-900">导入批次</span>
          <select
            value={activeDraft.id}
            onChange={(event) => setActiveDraftId(event.target.value)}
            className="h-8 min-w-64 rounded border bg-background px-2 text-xs outline-none"
          >
            {drafts.map((draft, index) => {
              const count = draft.budgetCount + draft.calendarCount + draft.riskCount;
              return (
                <option key={draft.id} value={draft.id}>
                  {index === 0 ? "最新批次" : `较早批次 ${index + 1}`} · {count} 条 · {new Date(draft.createdAt).toLocaleString("zh-CN")}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {expanded && (
        <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr_1fr]">
          <BudgetQueue
            draftId={activeDraft.id}
            items={pendingBudgetPreview}
            tasks={tasks}
            applyingKey={applyingKey}
            onApply={handleApplyBudget}
          />
          <CalendarQueue
            draftId={activeDraft.id}
            items={pendingCalendarPreview}
            applyingKey={applyingKey}
            onApply={handleApplyCalendar}
          />
          <RiskQueue
            draftId={activeDraft.id}
            items={pendingRiskPreview}
            applyingKey={applyingKey}
            onApply={handleApplyRisk}
          />
        </div>
      )}
    </div>
  );
}

function QueueStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/70 px-2 py-1">
      <div className="flex items-center justify-center gap-1 text-amber-900/70">
        {icon}
        {label}
      </div>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function BudgetQueue({
  draftId,
  items,
  tasks,
  applyingKey,
  onApply,
}: {
  draftId: string;
  items: BudgetPreview[];
  tasks: TaskOption[];
  applyingKey: string | null;
  onApply: (formData: FormData) => void;
}) {
  return (
    <div className="rounded-md border border-amber-200/70 bg-background/75">
      <QueueHeader icon={<WalletCards className="size-3.5 text-amber-700" />} title="预算候选" count={items.length} />
      {items.length === 0 ? (
        <EmptyQueue label="暂无待确认预算" />
      ) : (
        <div className="max-h-72 divide-y overflow-y-auto">
          {items.map((item) => {
            const recommendation = recommendBudgetTask(item, tasks);
            const suggestedFlowType = recommendedFlowType(item);
            const requiresManualFlow = needsManualFlowType(item);

            return (
              <form key={`budget-${draftId}-${item.candidateIndex}`} action={onApply} className="grid gap-2 px-3 py-2 text-xs">
                <input type="hidden" name="draftId" value={draftId} />
                <input type="hidden" name="candidateIndex" value={item.candidateIndex} />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate font-medium">{item.title ?? "未命名预算项"}</p>
                      {recommendation && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {[item.workstream, item.type, item.status].filter(Boolean).join(" · ") || "来源待确认"}
                    </p>
                  </div>
                  <span className="font-mono font-semibold">
                    {typeof item.amount === "number" ? `¥${item.amount.toLocaleString("zh-CN")}` : "待确认"}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_76px_48px] gap-1.5">
                  <select
                    name="taskId"
                    required
                    defaultValue={recommendation?.task.id ?? ""}
                    className="min-w-0 rounded border bg-background px-2 py-1 text-[11px] outline-none"
                  >
                    <option value="">关联管控事项</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="flowType"
                    required
                    defaultValue={suggestedFlowType}
                    className="rounded border bg-background px-2 py-1 text-[11px] outline-none"
                  >
                    <option value="">类型</option>
                    <option value="ALLOCATE">分配</option>
                    <option value="EXPENSE">支出</option>
                    <option value="REFUND">退款</option>
                  </select>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={applyingKey === `${draftId}:${item.candidateIndex}` || tasks.length === 0}
                  >
                    {applyingKey === `${draftId}:${item.candidateIndex}` ? <Loader2 className="size-3 animate-spin" /> : "入账"}
                  </Button>
                </div>
                <div className="space-y-0.5">
                  {requiresManualFlow ? (
                    <p className="text-[11px] text-amber-700">
                      {item.type ? `${item.type} 不是正式流水类型，需手动选择分配/支出/退款。` : "AI 未判断流水类型，需手动选择。"}
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-700">
                      建议类型：{FLOW_TYPE_LABEL[suggestedFlowType] ?? suggestedFlowType}
                    </p>
                  )}
                  {recommendation ? (
                    <p className="truncate text-[11px] text-emerald-700">
                      已推荐事项：{recommendation.task.name}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">未找到高置信关联，请手动选择事项。</p>
                  )}
                </div>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarQueue({
  draftId,
  items,
  applyingKey,
  onApply,
}: {
  draftId: string;
  items: CalendarPreview[];
  applyingKey: string | null;
  onApply: (formData: FormData) => void;
}) {
  return (
    <div className="rounded-md border border-amber-200/70 bg-background/75">
      <QueueHeader icon={<CalendarDays className="size-3.5 text-amber-700" />} title="日历候选" count={items.length} />
      {items.length === 0 ? (
        <EmptyQueue label="暂无待确认日历" />
      ) : (
        <div className="max-h-72 divide-y overflow-y-auto">
          {items.map((entry) => (
            <form
              key={`calendar-${draftId}-${entry.candidateIndex}`}
              action={onApply}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-xs"
            >
              <input type="hidden" name="draftId" value={draftId} />
              <input type="hidden" name="candidateIndex" value={entry.candidateIndex} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{[entry.date ?? "日期待确认", entry.startTime].filter(Boolean).join(" ")}</span>
                  {entry.channel && <span className="truncate">{entry.channel}</span>}
                </div>
                <p className="mt-0.5 truncate font-medium">{entry.content ?? "未命名日历项"}</p>
                {(entry.workstream || entry.status) && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {[entry.workstream, entry.status].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={applyingKey === `calendar:${draftId}:${entry.candidateIndex}`}
              >
                {applyingKey === `calendar:${draftId}:${entry.candidateIndex}` ? <Loader2 className="size-3 animate-spin" /> : "确认"}
              </Button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskQueue({
  draftId,
  items,
  applyingKey,
  onApply,
}: {
  draftId: string;
  items: RiskPreview[];
  applyingKey: string | null;
  onApply: (formData: FormData) => void;
}) {
  return (
    <div className="rounded-md border border-amber-200/70 bg-background/75">
      <QueueHeader icon={<ShieldAlert className="size-3.5 text-amber-700" />} title="风险/待确定项" count={items.length} />
      {items.length === 0 ? (
        <EmptyQueue label="暂无待确认风险" />
      ) : (
        <div className="max-h-72 divide-y overflow-y-auto">
          {items.map((risk) => (
            <form
              key={`risk-${draftId}-${risk.candidateIndex}`}
              action={onApply}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-xs"
            >
              <input type="hidden" name="draftId" value={draftId} />
              <input type="hidden" name="candidateIndex" value={risk.candidateIndex} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate font-medium">{risk.title ?? "未命名风险"}</p>
                  {risk.level && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{risk.level}</span>}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[risk.type, risk.description].filter(Boolean).join(" · ") || "需要补充处理动作"}
                </p>
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={applyingKey === `risk:${draftId}:${risk.candidateIndex}`}
              >
                {applyingKey === `risk:${draftId}:${risk.candidateIndex}` ? <Loader2 className="size-3 animate-spin" /> : "确认"}
              </Button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <span className="text-[10px] text-muted-foreground">{count} 待处理</span>
    </div>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return <p className="px-3 py-3 text-xs text-muted-foreground">{label}</p>;
}

function recommendBudgetTask(item: BudgetPreview, tasks: TaskOption[]) {
  if (tasks.length === 0) return null;

  const source = normalizeMatchText(
    [item.title, item.relatedItemName, item.workstream, item.description].filter(Boolean).join(" ")
  );
  if (!source) return null;

  const ranked = tasks
    .map((task) => ({ task, score: scoreTaskMatch(source, normalizeMatchText(task.name)) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return best && best.score >= 8 ? best : null;
}

function scoreTaskMatch(source: string, taskName: string) {
  if (!source || !taskName) return 0;
  if (source === taskName) return 100;
  if (source.includes(taskName) || taskName.includes(source)) return 60;

  const taskTokens = tokenizeForMatch(taskName);
  const sourceTokens = tokenizeForMatch(source);
  const tokenScore = taskTokens.reduce((score, token) => score + (source.includes(token) ? token.length : 0), 0);
  const sourceScore = sourceTokens.reduce((score, token) => score + (taskName.includes(token) ? token.length : 0), 0);

  return tokenScore + sourceScore;
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[《》【】（）()&+·\s_-]/g, "")
    .replace(/费用|预算|合作|专项|传播|内容|确认|执行|管理|项目/g, "")
    .trim();
}

function tokenizeForMatch(value: string) {
  const chunks = value.match(/[\u4e00-\u9fa5a-z0-9]{2,}/g) ?? [];
  return chunks.flatMap((chunk) => {
    if (chunk.length <= 4) return [chunk];
    const tokens = new Set<string>();
    for (let size = 2; size <= Math.min(4, chunk.length); size++) {
      for (let index = 0; index <= chunk.length - size; index++) {
        tokens.add(chunk.slice(index, index + size));
      }
    }
    return Array.from(tokens);
  });
}
