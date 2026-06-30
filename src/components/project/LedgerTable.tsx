"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, TrendingUp, TrendingDown, Wallet, Search, X, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BUDGET_OPERATION_MAP, FLOW_TYPE_MAP } from "@/lib/constants";
import { recordBudget, reverseBudgetFlow, updateBudgetFlowDescription } from "@/actions/ledger-actions";
import { cn } from "@/lib/utils";

type Flow = {
  id: string;
  taskId: string;
  counterpartyTaskId: string | null;
  groupId: string | null;
  flowType: "ALLOCATE" | "EXPENSE" | "REFUND";
  operation: string;
  amount: number;
  description: string;
  createdBy: string;
  createdAt: Date | string;
  task: { id: string; name: string };
  counterpartyTask: { id: string; name: string } | null;
};

type TaskOption = { id: string; name: string; status: string };

interface Props {
  plannedBudget: number;
  allocatedBudget: number;
  balance: number;
  used: number;
  usagePercent: number;
  flows: Flow[];
  tasks: TaskOption[];
}

const BUDGET_OPERATION_OPTIONS = [
  { value: "CONFIRM", label: "预算确定", hint: "确认项目预算池或总盘预算" },
  { value: "SUPPLEMENT", label: "预算增补", hint: "新增预算额度" },
  { value: "ALLOCATE", label: "分配到事项", hint: "从预算池分配给某个管控项" },
  { value: "EXPENSE", label: "实际支出", hint: "记录已发生费用" },
  { value: "REFUND", label: "支出退款", hint: "记录支出退款或冲销" },
] as const;

const MOVEMENT_OPERATIONS = new Set(["TRANSFER", "SPLIT", "MERGE"]);

export function LedgerTable({ plannedBudget, allocatedBudget, balance, used, usagePercent, flows, tasks }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskFilter, setTaskFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [operation, setOperation] = useState("EXPENSE");
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [reversingFlow, setReversingFlow] = useState<Flow | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [reversalReason, setReversalReason] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFlows = useMemo(() => {
    return flows.filter((flow) => {
      const matchesTask = taskFilter === "ALL" || flow.taskId === taskFilter;
      const matchesQuery = !normalizedQuery || [
        flow.task.name,
        flow.description,
        flow.createdBy,
        flow.flowType,
        flow.operation,
        BUDGET_OPERATION_MAP[flow.operation as keyof typeof BUDGET_OPERATION_MAP],
        FLOW_TYPE_MAP[flow.flowType as keyof typeof FLOW_TYPE_MAP],
        flow.counterpartyTask?.name,
        new Date(flow.createdAt).toLocaleDateString("zh-CN"),
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      return matchesTask && matchesQuery;
    });
  }, [flows, normalizedQuery, taskFilter]);

  useEffect(() => {
    const taskId = searchParams.get("ledgerTask");
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;
    const task = tasks.find((item) => item.id === taskId);
    setTaskFilter(taskId);
    setQuery(task?.name ?? "");
    setFocusedTaskId(taskId);
    window.setTimeout(() => setFocusedTaskId(null), 1800);
  }, [searchParams, tasks]);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await recordBudget(formData);
      if (result.success) {
        toast.success(result.message!);
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("记账失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateDescription() {
    if (!editingFlow || submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("flowId", editingFlow.id);
      formData.set("description", editingDescription);
      const result = await updateBudgetFlowDescription(formData);
      if (result.success) {
        toast.success(result.message ?? "说明已更新");
        setEditingFlow(null);
        setEditingDescription("");
        router.refresh();
      } else {
        toast.error(result.message ?? "更新失败");
      }
    } catch {
      toast.error("更新失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReverseFlow() {
    if (!reversingFlow || submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("flowId", reversingFlow.id);
      formData.set("reason", reversalReason);
      const result = await reverseBudgetFlow(formData);
      if (result.success) {
        toast.success(result.message ?? "流水已冲正");
        setReversingFlow(null);
        setReversalReason("");
        router.refresh();
      } else {
        toast.error(result.message ?? "冲正失败");
      }
    } catch {
      toast.error("冲正失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 结余概览卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" />
              已确认预算池
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              ¥{allocatedBudget.toLocaleString("zh-CN")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              计划预算 ¥{plannedBudget.toLocaleString("zh-CN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="size-4" />
              已使用
            </div>
            <p className="mt-1 text-2xl font-bold text-red-500 tabular-nums">
              ¥{used.toLocaleString("zh-CN")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              占确认预算 {usagePercent}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" />
              当前可用结余
            </div>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                balance >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              ¥{balance.toLocaleString("zh-CN")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 表头 + 新增按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          显示 {visibleFlows.length} / {flows.length} 条流水记录
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          新增预算动作
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={taskFilter}
          onChange={(event) => setTaskFilter(event.target.value)}
          className="h-9 min-w-48 rounded-md border bg-background px-3 text-xs outline-none"
        >
          <option value="ALL">全部事项</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>{task.name}</option>
          ))}
        </select>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索事项、事由、操作人或类型"
            className="h-9 w-full rounded-full border bg-background pl-8 pr-9 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            data-ledger-search="true"
          />
          {(query || taskFilter !== "ALL") && (
            <button
              type="button"
              aria-label="清空预算筛选"
              onClick={() => {
                setQuery("");
                setTaskFilter("ALL");
              }}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Shadcn 风格表格 */}
      {flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无流水记录</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            点击「新增预算动作」记录第一笔预算
          </p>
        </div>
      ) : visibleFlows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14 text-center">
          <p className="text-sm text-muted-foreground">当前条件下暂无预算流水</p>
          <p className="mt-1 text-xs text-muted-foreground/60">调整筛选或清空搜索查看完整预算流转</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">时间</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">事项</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">动作</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">对方事项</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">金额</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">事由</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">操作人</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleFlows.map((flow) => (
                  <tr
                    key={flow.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      focusedTaskId === flow.taskId && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                    )}
                  >
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(flow.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{flow.task.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={flow.flowType === "EXPENSE" ? "destructive" : "default"}>
                        {BUDGET_OPERATION_MAP[flow.operation as keyof typeof BUDGET_OPERATION_MAP] ??
                          FLOW_TYPE_MAP[flow.flowType as keyof typeof FLOW_TYPE_MAP] ??
                          flow.operation}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {flow.counterpartyTask?.name ?? "-"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums whitespace-nowrap ${flow.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {flow.amount > 0 ? "+" : ""}
                      {flow.amount.toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <p className="truncate">{flow.description}</p>
                      {flow.operation === "REVERSAL" && (
                        <span className="mt-1 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          冲正记录
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{flow.createdBy}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setEditingFlow(flow);
                            setEditingDescription(flow.description);
                          }}
                        >
                          <Pencil className="mr-1 size-3" />
                          说明
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          disabled={flow.operation === "REVERSAL"}
                          onClick={() => {
                            setReversingFlow(flow);
                            setReversalReason("");
                          }}
                        >
                          <RotateCcw className="mr-1 size-3" />
                          冲正
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shadcn Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增预算动作</DialogTitle>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            Alpha 阶段只开放高频预算动作。拆分、合并、事项间划拨等高级流转先保留在底层，避免外测用户误操作。
          </div>
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                关联事项 <span className="text-red-500">*</span>
              </label>
              <select
                name="taskId"
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
              >
                <option value="">请选择事项</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                预算动作 <span className="text-red-500">*</span>
              </label>
              <select
                name="operation"
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
                required
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {BUDGET_OPERATION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} - {item.hint}
                  </option>
                ))}
              </select>
            </div>

            {MOVEMENT_OPERATIONS.has(operation) && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  目标事项 <span className="text-red-500">*</span>
                </label>
                <select
                  name="counterpartyTaskId"
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">请选择目标事项</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  当前“关联事项”为来源事项，目标事项会生成对应的正向入账记录。
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">
                金额 (¥) <span className="text-red-500">*</span>
              </label>
              <input
                name="amount" type="number" required min="0" step="0.01"
                placeholder="输入正数金额，系统会按动作自动记录正负方向"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                事由 <span className="text-red-500">*</span>
              </label>
              <input
                name="description" required
                placeholder="例如：直播执行预算从场地项划拨到投流项"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                确认记录
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingFlow)} onOpenChange={(nextOpen) => !nextOpen && setEditingFlow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改流水说明</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              只修改说明，不改变金额和余额。修改记录会写入项目活动。
            </div>
            <textarea
              value={editingDescription}
              onChange={(event) => setEditingDescription(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setEditingFlow(null)}>取消</Button>
              <Button type="button" disabled={submitting || !editingDescription.trim()} onClick={handleUpdateDescription}>
                {submitting ? "保存中" : "保存说明"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reversingFlow)} onOpenChange={(nextOpen) => !nextOpen && setReversingFlow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>冲正预算流水</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
              冲正会新增一条反向流水，不删除原记录。适合修正 AI 误入账、金额方向错误或人工误记。
            </div>
            {reversingFlow && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                原流水：{reversingFlow.task.name} · {reversingFlow.description} · ¥{reversingFlow.amount.toLocaleString("zh-CN")}
              </div>
            )}
            <textarea
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="填写冲正原因，例如：AI 将预算估算误入账，需撤回。"
              rows={3}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setReversingFlow(null)}>取消</Button>
              <Button type="button" variant="destructive" disabled={submitting || !reversalReason.trim()} onClick={handleReverseFlow}>
                {submitting ? "冲正中" : "确认冲正"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
