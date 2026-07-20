"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteProject, setProjectArchived, updateProjectInfo } from "@/actions/project-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";

type ProjectSummary = { id: string; name: string; startDate: Date | string | null; endDate: Date | string | null; archivedAt: Date | string | null };
type SettingsSection = "project" | "members";

function dateValue(value: Date | string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }

export function ProjectManageActions({ project, canEdit, canManage }: { project: ProjectSummary; canEdit: boolean; canManage: boolean }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("project");
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  if (!canEdit) return null;

  function openSettings(section: SettingsSection) { setSettingsSection(section); setEditing(false); setSaveState("idle"); setSettingsOpen(true); setMenuOpen(false); }
  async function saveInfo(formData: FormData) {
    if (submitting) return;
    setSubmitting(true); setSaveState("idle"); formData.set("projectId", project.id);
    try {
      const result = await updateProjectInfo(formData);
      if (!result.success) toast.error(result.message ?? "保存失败");
      else { setEditing(false); setSaveState("saved"); router.refresh(); }
    } catch { toast.error("保存失败，请重试"); } finally { setSubmitting(false); }
  }
  async function changeArchive() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await setProjectArchived(project.id, !project.archivedAt);
      if (!result.success) toast.error(result.message ?? "操作失败");
      else { toast.success(result.message ?? "项目状态已更新"); setArchiveOpen(false); router.refresh(); }
    } catch { toast.error("操作失败，请重试"); } finally { setSubmitting(false); }
  }
  async function confirmDelete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await deleteProject(project.id);
      if (!result.success) toast.error(result.message ?? "删除失败");
      else { toast.success(result.message ?? "项目已删除"); router.push("/workspace"); router.refresh(); }
    } catch { toast.error("删除失败，请重试"); } finally { setSubmitting(false); }
  }

  return <div className="relative">
    <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal className="size-4" />更多</Button>
    {menuOpen && <div role="menu" className="absolute right-0 top-10 z-30 min-w-40 rounded-[10px] border border-border bg-popover p-1 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
      <MenuItem onClick={() => openSettings("project")}>项目设置</MenuItem>
      <MenuItem onClick={() => openSettings("members")}>成员与权限</MenuItem>
      {canManage && <><div className="my-1 border-t border-border" /><MenuItem onClick={() => { setArchiveOpen(true); setMenuOpen(false); }}>{project.archivedAt ? "恢复项目" : "归档项目"}</MenuItem><MenuItem danger onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}>删除项目</MenuItem></>}
    </div>}

    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}><SheetContent className="max-w-lg"><SheetHeader title={settingsSection === "project" ? "项目设置" : "成员与权限"} />
      {settingsSection === "project" ? <ProjectSettings project={project} editing={editing} submitting={submitting} saveState={saveState} onEdit={() => { setEditing(true); setSaveState("idle"); }} onCancel={() => setEditing(false)} onSave={saveInfo} /> : <ProjectMembersInfo />}
    </SheetContent></Sheet>

    <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}><DialogContent><DialogHeader><DialogTitle>{project.archivedAt ? "恢复项目" : "归档项目"}</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">{project.archivedAt ? `「${project.name}」会恢复到工作区和侧边栏项目列表。` : `归档后，「${project.name}」会移出日常项目列表，历史数据和活动记录保持可追溯。`}</p><DialogFooter><Button type="button" variant="ghost" onClick={() => setArchiveOpen(false)}>取消</Button><Button type="button" disabled={submitting} onClick={changeArchive}>{submitting ? <Loader2 className="size-3.5 animate-spin" /> : project.archivedAt ? "恢复项目" : "确认归档"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>删除项目</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">这会永久删除项目、事项、预算、日历和成员关联，无法恢复。仅项目主负责人可以执行此操作。</p><DialogFooter><Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button><Button type="button" variant="destructive" disabled={submitting} onClick={confirmDelete}>{submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}确认删除</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ProjectSettings({ project, editing, submitting, saveState, onEdit, onCancel, onSave }: { project: ProjectSummary; editing: boolean; submitting: boolean; saveState: "idle" | "saved"; onEdit: () => void; onCancel: () => void; onSave: (formData: FormData) => void }) {
  if (editing) return <form action={onSave} className="flex flex-1 flex-col overflow-y-auto"><div className="space-y-4 px-5 py-5"><label className="block text-sm font-medium">项目名称<Input name="name" required defaultValue={project.name} className="mt-1.5" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">开始日期<Input name="startDate" type="date" defaultValue={dateValue(project.startDate)} className="mt-1.5" /></label><label className="text-sm font-medium">结束日期<Input name="endDate" type="date" defaultValue={dateValue(project.endDate)} className="mt-1.5" /></label></div></div><div className="mt-auto flex justify-end gap-2 border-t border-border px-5 py-4"><Button type="button" variant="ghost" onClick={onCancel}>取消</Button><Button type="submit" disabled={submitting}>{submitting ? "保存中" : "保存"}</Button></div></form>;
  return <div className="flex-1 overflow-y-auto px-5 py-5"><div className="absolute right-12 top-3"><Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onEdit}><Pencil className="size-3.5" />编辑</Button></div><div className="space-y-5"><ReadField label="项目名称" value={project.name} /><ReadField label="项目周期" value={`${dateValue(project.startDate) || "未定"} 至 ${dateValue(project.endDate) || "未定"}`} /></div>{saveState === "saved" && <p className="mt-6 text-xs text-success">已保存</p>}</div>;
}

function ProjectMembersInfo() { return <div className="flex-1 overflow-y-auto px-5 py-5"><div className="flex items-center gap-2 text-sm font-medium"><Users className="size-4 text-muted-foreground" />成员与权限</div><p className="mt-3 text-sm leading-6 text-muted-foreground">项目成员与项目级权限保持独立于事项负责人。团队管理页面负责维护成员账号；项目内协作成员会在下一轮项目权限面板中集中呈现。</p></div>; }
function ReadField({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm leading-6 text-secondary-foreground">{value}</p></div>; }
function MenuItem({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) { return <button type="button" role="menuitem" onClick={onClick} className={danger ? "flex min-h-9 w-full items-center rounded-md px-2.5 text-left text-sm text-destructive hover:bg-destructive/10" : "flex min-h-9 w-full items-center rounded-md px-2.5 text-left text-sm text-foreground hover:bg-surface-2"}>{children}</button>; }
