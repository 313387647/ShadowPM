"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Coins, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/actions/project-actions";

export function ProjectCard({
  id, name, totalBudget, startDate, endDate, taskCount,
}: {
  id: string; name: string; totalBudget: number;
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
      className="group relative rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors pr-6">
        {name}
      </h3>

      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="size-4" />
        <span className="font-mono font-medium text-foreground">
          ¥{totalBudget.toLocaleString("zh-CN")}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {startDate ? new Date(startDate).toLocaleDateString("zh-CN") : "未定"}
          {" — "}
          {endDate ? new Date(endDate).toLocaleDateString("zh-CN") : "未定"}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <CheckCircle2 className="size-3" />
          {taskCount} 个任务
        </span>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        title="删除项目"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </Link>
  );
}
