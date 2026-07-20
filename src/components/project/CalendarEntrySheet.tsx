"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCalendarEntry, updateCalendarEntry } from "@/actions/calendar-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTime, STATUS_LABEL, toDateInput, type CalendarEntry, type TaskOption } from "@/components/project/calendar-types";

export function CalendarEntrySheet({ entry, tasks, canEdit, onClose }: { entry: CalendarEntry | null; tasks: TaskOption[]; canEdit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  if (!entry) return null;
  const currentEntry = entry;

  async function save(formData: FormData) {
    if (!canEdit) return;
    setSaving(true); setSaveState("idle"); formData.set("entryId", currentEntry.id);
    try {
      const result = await updateCalendarEntry(formData);
      if (!result.success) toast.error(result.message ?? "保存失败");
      else { setEditing(false); setSaveState("saved"); router.refresh(); }
    } catch { toast.error("保存失败"); } finally { setSaving(false); }
  }
  async function remove() {
    setDeleting(true);
    try {
      const result = await deleteCalendarEntry(currentEntry.id);
      if (!result.success) toast.error(result.message ?? "删除失败");
      else { toast.success("执行节点已删除"); setDeleteOpen(false); onClose(); router.refresh(); }
    } catch { toast.error("删除失败"); } finally { setDeleting(false); }
  }

  return <><Sheet open onOpenChange={(open) => !open && onClose()}><SheetContent className="max-w-xl"><SheetHeader title={entry.content} description="执行节点" />
    {canEdit && <div className="absolute right-12 top-3 flex items-center gap-1"><Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => { setEditing((value) => !value); setSaveState("idle"); }}><Pencil className="size-3.5" />{editing ? "取消" : "编辑"}</Button></div>}
    {editing ? <EntryEditForm entry={entry} tasks={tasks} saving={saving} onSave={save} onDelete={() => setDeleteOpen(true)} /> : <EntryReadView entry={entry} saveState={saveState} />}
  </SheetContent></Sheet>
  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>删除执行节点</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">删除只会移除当前排期，关联事项仍会保留，删除事实会写入项目活动。</p><DialogFooter><Button variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button><Button variant="destructive" disabled={deleting} onClick={remove}>{deleting ? "删除中" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog></>;
}

function EntryReadView({ entry, saveState }: { entry: CalendarEntry; saveState: "idle" | "saved" }) {
  return <div className="flex-1 overflow-y-auto px-5 py-5"><div className="space-y-5"><ReadField label="日期与时间" value={`${formatDate(entry.date)} · ${formatTime(entry)}`} /><ReadField label="状态" value={STATUS_LABEL[entry.status] ?? entry.status} /><ReadField label="渠道" value={entry.channel || "待补渠道"} /><ReadField label="负责人" value={entry.owner || "待补负责人"} /><ReadField label="关联事项" value={entry.task?.name || "未关联事项"} /><ReadField label="备注" value={entry.notes || "暂无备注"} /></div>{saveState === "saved" && <p className="mt-6 text-xs text-success">已保存</p>}</div>;
}

function EntryEditForm({ entry, tasks, saving, onSave, onDelete }: { entry: CalendarEntry; tasks: TaskOption[]; saving: boolean; onSave: (data: FormData) => void; onDelete: () => void }) {
  return <form action={onSave} className="flex flex-1 flex-col overflow-y-auto"><div className="space-y-4 px-5 py-5"><label className="block text-sm font-medium">执行内容<Input name="content" required defaultValue={entry.content} className="mt-1.5" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">日期<Input name="date" type="date" defaultValue={toDateInput(entry.date)} className="mt-1.5" /></label><label className="text-sm font-medium">状态<Select name="status" defaultValue={entry.status} className="mt-1.5"><option value="PLANNED">计划中</option><option value="CONFIRMED">已确认</option><option value="DONE">已完成</option><option value="CANCELED">已取消</option></Select></label><label className="text-sm font-medium">开始时间<Input name="startTime" type="time" defaultValue={entry.startTime ?? ""} className="mt-1.5" /></label><label className="text-sm font-medium">结束时间<Input name="endTime" type="time" defaultValue={entry.endTime ?? ""} className="mt-1.5" /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">渠道<Input name="channel" defaultValue={entry.channel ?? ""} className="mt-1.5" /></label><label className="text-sm font-medium">负责人<Input name="owner" defaultValue={entry.owner ?? ""} className="mt-1.5" /></label></div><label className="block text-sm font-medium">关联事项<Select name="taskId" defaultValue={entry.taskId ?? ""} className="mt-1.5"><option value="">未关联</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</Select></label><label className="block text-sm font-medium">备注<Textarea name="notes" defaultValue={entry.notes ?? ""} rows={3} className="mt-1.5" /></label><input type="hidden" name="workstream" value={entry.workstream ?? ""} /><input type="hidden" name="department" value={entry.department ?? ""} /></div><div className="mt-auto flex items-center justify-between border-t border-border px-5 py-4"><Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="size-3.5" />删除</Button><Button type="submit" size="sm" disabled={saving}>{saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}保存</Button></div></form>;
}

function ReadField({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-secondary-foreground">{value}</p></div>; }
