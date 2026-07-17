"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteProject, setProjectArchived, updateProjectInfo } from "@/actions/project-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";

type ProjectSummary = {
  id: string;
  name: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  archivedAt: Date | string | null;
};

function dateValue(value: Date | string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function ProjectManageActions({ project, canEdit, canManage }: { project: ProjectSummary; canEdit: boolean; canManage: boolean }) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!canEdit) return null;

  async function saveInfo(formData: FormData) {
    if (submitting) return;
    setSubmitting(true);
    formData.set("projectId", project.id);
    try {
      const result = await updateProjectInfo(formData);
      if (!result.success) {
        toast.error(result.message ?? "保存失败");
        return;
      }
      toast.success(result.message ?? "项目基本信息已更新");
      setSettingsOpen(false);
      router.refresh();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeArchive() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await setProjectArchived(project.id, !project.archivedAt);
      if (!result.success) {
        toast.error(result.message ?? "操作失败");
        return;
      }
      toast.success(result.message ?? "项目状态已更新");
      setArchiveOpen(false);
      router.refresh();
    } catch {
      toast.error("操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await deleteProject(project.id);
      if (!result.success) {
        toast.error(result.message ?? "删除失败");
        return;
      }
      toast.success(result.message ?? "项目已删除");
      router.push("/workspace");
      router.refresh();
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full justify-end gap-2">
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setSettingsOpen(true)}>
        <MoreHorizontal className="size-3.5" />更多
      </Button>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="max-w-lg">
          <SheetHeader title="项目设置" description="维护项目资料；成员和权限在此处集中管理。" />
          <div className="flex-1 overflow-y-auto p-5">
          <form action={saveInfo} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">项目名称</label>
              <input name="name" required defaultValue={project.name} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">开始日期</label>
                <input name="startDate" type="date" defaultValue={dateValue(project.startDate)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">结束日期</label>
                <input name="endDate" type="date" defaultValue={dateValue(project.endDate)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">项目预算由资金账本的“总预算确认”维护，避免项目资料与账本出现两个口径。</p>
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>取消</Button><Button type="submit" disabled={submitting}>{submitting ? "保存中" : "保存"}</Button></div>
          </form>
          {canManage && <><section className="mt-8 border-t pt-5"><p className="text-sm font-medium">项目生命周期</p><p className="mt-1 text-xs text-muted-foreground">归档会移出日常工作区，历史数据保持可追溯。</p><Button type="button" size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setArchiveOpen(true)}>{project.archivedAt ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}{project.archivedAt ? "恢复项目" : "归档项目"}</Button></section><section className="mt-6 border-t border-destructive/20 pt-5"><p className="text-sm font-medium text-destructive">危险操作</p><p className="mt-1 text-xs text-muted-foreground">删除后无法恢复，项目活动会同时移除。</p><Button type="button" size="sm" variant="ghost" className="mt-3 gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="size-3.5" />删除项目</Button></section></>}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{project.archivedAt ? "恢复项目" : "归档项目"}</DialogTitle></DialogHeader>
          <p className="text-sm leading-6 text-muted-foreground">{project.archivedAt ? `「${project.name}」会恢复到工作区和侧边栏项目列表。` : `归档后，「${project.name}」会移入侧边栏“已归档”，数据和活动记录均保留。`}</p>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => setArchiveOpen(false)}>取消</Button><Button type="button" disabled={submitting} onClick={changeArchive} className="gap-1.5">{submitting ? <Loader2 className="size-3.5 animate-spin" /> : project.archivedAt ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}{project.archivedAt ? "恢复项目" : "确认归档"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>删除项目</DialogTitle></DialogHeader>
          <p className="text-sm leading-6 text-muted-foreground">这会永久删除项目、事项、预算、日历和成员关联，无法恢复。仅项目主负责人可以执行此操作。</p>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button><Button type="button" variant="destructive" disabled={submitting} onClick={confirmDelete} className="gap-1.5">{submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}确认删除</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
