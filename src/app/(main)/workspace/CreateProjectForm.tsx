"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createProject } from "@/actions/project-actions";
import { AIProjectCreator } from "@/components/project/AIProjectPreview";

export function CreateProjectForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const result = await createProject(formData);
      if (result.success) {
        toast.success(result.message!);
        formRef.current?.reset();
        setOpen(false);
        if (result.data?.projectId) {
          router.push(`/projects/${result.data.projectId}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="size-4" />新建项目
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>

          {/* Tab 切换 */}
          <div className="flex rounded-lg border bg-muted/40 p-1 -mx-1">
            <button
              onClick={() => setMode("ai")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                mode === "ai"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5" />
              AI 生成
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                mode === "manual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ✏️ 手动创建
            </button>
          </div>

          {/* 内容区 */}
          {mode === "ai" ? (
            <AIProjectCreator onClose={() => setOpen(false)} />
          ) : (
            <form action={handleSubmit} ref={formRef} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input name="name" required placeholder="例如：仰望一万台整合营销" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  总预算 (¥)
                </label>
                <input name="totalBudget" type="number" min="0" step="0.01" placeholder="可留空，稍后在资金账本确认" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">开始日期</label>
                  <input name="startDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">结束日期</label>
                  <input name="endDate" type="date" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  创建项目
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
