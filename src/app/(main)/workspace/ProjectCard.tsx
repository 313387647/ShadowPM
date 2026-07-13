"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Coins, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/actions/project-actions";

export function ProjectCard({
  id, name, totalBudget, confirmedBudget, pendingBudgetSignal, startDate, endDate, taskCount,
}: {
  id: string;
  name: string;
  totalBudget: number;
  confirmedBudget: number;
  pendingBudgetSignal?: { total: number; count: number };
  startDate: Date | null; endDate: Date | null; taskCount: number;
}) {
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`确定要删除「${name}」吗？此操作不可撤销。`)) return;
    try {
      const result = await deleteProject(id);
      if (result.success) {
        toast.success(result.message!);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("删除失败");
    }
  }

  return (
    <Link
      href={`/projects/${id}`}
      className="group relative block border-b px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/45"
    >
      <h3 className="truncate pr-7 text-sm font-medium transition-colors group-hover:text-primary">
        {name}
      </h3>

      <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Coins className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0">
          {confirmedBudget > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>已确认</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                ¥{confirmedBudget.toLocaleString("zh-CN")}
              </span>
              {totalBudget > 0 && totalBudget !== confirmedBudget && (
                <span className="text-xs text-muted-foreground">
                  / 计划 ¥{totalBudget.toLocaleString("zh-CN")}
                </span>
              )}
            </div>
          ) : totalBudget > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>计划预算</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                ¥{totalBudget.toLocaleString("zh-CN")}
              </span>
              <span className="text-amber-700">待确认</span>
            </div>
          ) : pendingBudgetSignal && pendingBudgetSignal.count > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-amber-700">待确认线索</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                ¥{pendingBudgetSignal.total.toLocaleString("zh-CN")}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">预算待确认</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {startDate ? new Date(startDate).toLocaleDateString("zh-CN") : "未定"}
          {" — "}
          {endDate ? new Date(endDate).toLocaleDateString("zh-CN") : "未定"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <CheckCircle2 className="size-3" />
          {taskCount} 个事项
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7 opacity-0 transition-opacity text-muted-foreground hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
        onClick={handleDelete}
        title="删除项目"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </Link>
  );
}
