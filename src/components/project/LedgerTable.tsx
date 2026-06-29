"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, TrendingUp, TrendingDown, Wallet, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FLOW_TYPE_MAP } from "@/lib/constants";
import { recordBudget } from "@/actions/ledger-actions";
import { cn } from "@/lib/utils";

type Flow = {
  id: string;
  taskId: string;
  flowType: "ALLOCATE" | "EXPENSE" | "REFUND";
  amount: number;
  description: string;
  createdBy: string;
  createdAt: Date | string;
  task: { id: string; name: string };
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

const FLOW_COLORS: Record<string, string> = {
  ALLOCATE: "text-emerald-600",
  EXPENSE: "text-red-500",
  REFUND: "text-emerald-600",
};

export function LedgerTable({ plannedBudget, allocatedBudget, balance, used, usagePercent, flows, tasks }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskFilter, setTaskFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFlows = useMemo(() => {
    return flows.filter((flow) => {
      const matchesTask = taskFilter === "ALL" || flow.taskId === taskFilter;
      const matchesQuery = !normalizedQuery || [
        flow.task.name,
        flow.description,
        flow.createdBy,
        flow.flowType,
        FLOW_TYPE_MAP[flow.flowType as keyof typeof FLOW_TYPE_MAP],
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
          新增流水
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
            点击「新增流水」记录第一笔预算
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
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">所属任务</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">类型</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">金额</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">事由</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">操作人</th>
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
                        {FLOW_TYPE_MAP[flow.flowType as keyof typeof FLOW_TYPE_MAP] ?? flow.flowType}
                      </Badge>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums whitespace-nowrap ${FLOW_COLORS[flow.flowType] ?? ""}`}>
                      {flow.amount > 0 ? "+" : ""}
                      {flow.amount.toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate">{flow.description}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{flow.createdBy}</td>
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
            <DialogTitle>新增流水</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                所属任务 <span className="text-red-500">*</span>
              </label>
              <select
                name="taskId"
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
              >
                <option value="">请选择任务</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                流水类型 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {(["ALLOCATE", "EXPENSE", "REFUND"] as const).map((type) => (
                  <label
                    key={type}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary"
                  >
                    <input type="radio" name="flowType" value={type} defaultChecked={type === "EXPENSE"} required className="sr-only" />
                    {type === "ALLOCATE" && "📥 分配"}
                    {type === "EXPENSE" && "📤 支出"}
                    {type === "REFUND" && "↩️ 退款"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                金额 (¥) <span className="text-red-500">*</span>
              </label>
              <input
                name="amount" type="number" required min="0" step="0.01"
                placeholder="输入正数金额，支出会自动转为负数"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                事由 <span className="text-red-500">*</span>
              </label>
              <input
                name="description" required
                placeholder="例如：新闻通稿撰写及媒体投放费用"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                确认记账
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
