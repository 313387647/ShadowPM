"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/actions/task-actions";
import { addProgressLog } from "@/actions/timeline-actions";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  notes: string | null;
  assignee: string | null;
  department: string | null;
  deadline: Date | string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  phaseId: string | null;
  priority: string;
  aiConfidence?: string | null;
  sourceRef?: string | null;
  needsConfirmation?: boolean;
  logs: { id: string; content: string; createdBy: string; createdAt: Date | string }[];
  _count: { logs: number; calendarEntries: number };
};
type PhaseOption = { id: string; name: string };
type Filter = "ALL" | "MINE" | "OVERDUE" | "THIS_WEEK" | "MISSING";
type Field = "assignee" | "deadline" | "notes";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "MINE", label: "需要我处理" }, { value: "OVERDUE", label: "已逾期" }, { value: "THIS_WEEK", label: "本周到期" }, { value: "MISSING", label: "待补信息" }, { value: "ALL", label: "全部事项" },
];
const STATUS_STYLE: Record<Task["status"], string> = { PENDING: "border-warning/25 bg-warning/10 text-warning", IN_PROGRESS: "border-primary/25 bg-primary/10 text-primary", COMPLETED: "border-success/25 bg-success/10 text-success" };

export function ProjectControlTable({ projectId, tasks, phases, canEdit, viewerName }: { projectId: string; tasks: Task[]; phases: PhaseOption[]; canEdit: boolean; viewerName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const filterFromUrl = searchParams.get("taskFilter");
  const initialFilter: Filter = isFilter(filterFromUrl) ? filterFromUrl : "ALL";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(tasks.length === 0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  useEffect(() => {
    const focusedTask = searchParams.get("focusTask");
    if (!focusedTask) return;
    const task = tasks.find((item) => item.id === focusedTask);
    if (task) setSelectedTask(task);
  }, [searchParams, tasks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTyping(event.target)) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape" && document.activeElement === searchRef.current) setQuery("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleTasks = useMemo(() => tasks.filter((task) => matchesFilter(task, filter, viewerName) && matchesQuery(task, query)), [filter, query, tasks, viewerName]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item.value, tasks.filter((task) => matchesFilter(task, item.value, viewerName)).length])), [tasks, viewerName]) as Record<Filter, number>;

  function selectFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "ALL") params.delete("taskFilter"); else params.set("taskFilter", nextFilter);
    router.replace(`/projects/${projectId}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold">管控事项</h2><p className="mt-1 text-xs text-muted-foreground">先扫描状态与信号；点击一行查看详情，点击字段才编辑。</p></div>{canEdit && <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowQuickAdd((value) => !value)}><Plus className="size-3.5" />添加事项</Button>}</div>
    {canEdit && showQuickAdd && <ControlItemQuickAdd projectId={projectId} phases={phases} onComplete={() => { setShowQuickAdd(false); router.refresh(); }} />}
    <section className="table-shell">
      <ControlTableToolbar filter={filter} counts={counts} query={query} searchRef={searchRef} onFilter={selectFilter} onQuery={setQuery} />
      <div className="overflow-x-auto">
        {visibleTasks.length === 0 ? <div className="px-4 py-14 text-center text-sm text-muted-foreground">当前筛选下暂无管控事项。</div> : <table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b border-border bg-muted/25 text-xs text-muted-foreground"><tr><th className="min-w-[290px] px-4 py-2.5 font-medium">事项</th><th className="w-[110px] px-3 py-2.5 font-medium">状态</th><th className="w-[130px] px-3 py-2.5 font-medium">负责人</th><th className="w-[120px] px-3 py-2.5 font-medium">截止日期</th><th className="min-w-[210px] px-3 py-2.5 font-medium">最新进展</th><th className="min-w-[150px] px-3 py-2.5 font-medium">关注信号</th><th className="w-[52px] px-2 py-2.5"><span className="sr-only">更多操作</span></th></tr></thead><tbody className="divide-y divide-border">{visibleTasks.map((task) => <ControlTableRow key={task.id} task={task} phases={phases} canEdit={canEdit} onOpen={() => setSelectedTask(task)} onDelete={() => setDeleteTarget(task)} />)}</tbody></table>}
      </div>
    </section>
    <ControlItemDetailSheet task={selectedTask} phases={phases} canEdit={canEdit} onOpenChange={(open) => !open && setSelectedTask(null)} onDelete={() => { if (selectedTask) setDeleteTarget(selectedTask); }} />
    <DeleteTaskDialog task={deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); setSelectedTask(null); router.refresh(); }} />
  </div>;
}

function ControlTableToolbar({ filter, counts, query, searchRef, onFilter, onQuery }: { filter: Filter; counts: Record<Filter, number>; query: string; searchRef: React.RefObject<HTMLInputElement>; onFilter: (filter: Filter) => void; onQuery: (query: string) => void }) { return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5"><div className="flex flex-wrap gap-1">{FILTERS.map((item) => <button key={item.value} type="button" onClick={() => onFilter(item.value)} className={filter === item.value ? "rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary" : "rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}>{item.label}<span className="ml-1.5 tabular-nums opacity-70">{counts[item.value]}</span></button>)}</div><div className="relative w-full sm:w-60"><input ref={searchRef} value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索事项、负责人" className="h-8 w-full rounded-md border border-border bg-background px-2.5 pr-8 text-xs outline-none focus:border-primary" /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">/</span></div></div>; }

function ControlTableRow({ task, phases, canEdit, onOpen, onDelete }: { task: Task; phases: PhaseOption[]; canEdit: boolean; onOpen: () => void; onDelete: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const phaseName = phases.find((phase) => phase.id === task.phaseId)?.name;

  function beginEdit(field: Field) { if (!canEdit) return; setDraft(field === "deadline" ? toDateInput(task.deadline) : task[field] ?? ""); setEditing(field); }
  function cancelEdit() { setEditing(null); setDraft(""); }
  async function saveField(field: Field) { if (!canEdit || saving) return; setSaving(true); const formData = taskFormData(task); formData.set(field, draft); try { const result = await updateTask(formData); if (!result.success) toast.error(result.message ?? "保存失败"); else { setEditing(null); router.refresh(); } } catch { toast.error("保存失败"); } finally { setSaving(false); } }
  async function changeStatus(status: Task["status"]) { if (!canEdit || status === task.status) return; const result = await updateTaskStatus(task.id, status); if (!result.success) toast.error(result.message ?? "状态更新失败"); else router.refresh(); }
  function keyboardSave(event: React.KeyboardEvent<HTMLInputElement>) { if (event.key === "Enter") { event.preventDefault(); if (editing) saveField(editing); } if (event.key === "Escape") cancelEdit(); }

  return <tr className="group cursor-pointer transition-colors hover:bg-primary/[0.04]" onClick={onOpen}>
    <td className="px-4 py-3"><div className="min-w-0"><div className="mb-1 flex flex-wrap gap-1.5">{phaseName && <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{phaseName}</span>}{task.sourceRef && <span className="rounded border border-primary/20 bg-primary/[0.07] px-1.5 py-0.5 text-[10px] text-primary">AI 导入</span>}</div><p className="truncate font-medium">{task.name}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.description || "未补充描述"}</p></div></td>
    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}><select aria-label="更新事项状态" disabled={!canEdit} value={task.status} onChange={(event) => changeStatus(event.target.value as Task["status"])} className={cn("h-7 rounded border px-1.5 text-xs font-medium outline-none", STATUS_STYLE[task.status], canEdit && "cursor-pointer")}><option value="PENDING">待启动</option><option value="IN_PROGRESS">进行中</option><option value="COMPLETED">已完成</option></select></td>
    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>{editing === "assignee" ? <InlineInput value={draft} placeholder="负责人" saving={saving} onChange={setDraft} onKeyDown={keyboardSave} onBlur={() => saveField("assignee")} /> : <button type="button" onClick={() => beginEdit("assignee")} className={task.assignee ? "text-left text-sm hover:text-primary" : "text-left text-sm text-warning hover:text-primary"}>{task.assignee || "待补负责人"}</button>}</td>
    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>{editing === "deadline" ? <InlineInput value={draft} type="date" saving={saving} onChange={setDraft} onKeyDown={keyboardSave} onBlur={() => saveField("deadline")} /> : <button type="button" onClick={() => beginEdit("deadline")} className={isOverdue(task) ? "text-xs font-medium text-destructive hover:text-primary" : "text-xs text-muted-foreground hover:text-primary"}>{task.deadline ? formatDate(task.deadline) : "待补日期"}</button>}</td>
    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>{editing === "notes" ? <InlineInput value={draft} placeholder="最新进展" saving={saving} onChange={setDraft} onKeyDown={keyboardSave} onBlur={() => saveField("notes")} /> : <button type="button" onClick={() => beginEdit("notes")} className="line-clamp-2 text-left text-xs leading-5 text-secondary-foreground hover:text-primary">{task.notes || "暂无进展"}</button>}</td>
    <td className="px-3 py-3"><ControlItemSignals task={task} /></td>
    <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}><Button type="button" variant="ghost" size="icon" className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" title="更多操作" onClick={onOpen}><MoreHorizontal className="size-3.5" /></Button>{canEdit && <button type="button" className="sr-only" onClick={onDelete}>删除事项</button>}</td>
  </tr>;
}

function InlineInput({ value, type = "text", placeholder, saving, onChange, onKeyDown, onBlur }: { value: string; type?: string; placeholder?: string; saving: boolean; onChange: (value: string) => void; onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void; onBlur: () => void }) { return <input autoFocus type={type} value={value} placeholder={placeholder} disabled={saving} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} onBlur={onBlur} className="h-7 w-full rounded border border-primary bg-background px-1.5 text-xs outline-none" />; }

function ControlItemSignals({ task }: { task: Task }) { const signals = [isOverdue(task) ? "已逾期" : null, !task.assignee ? "待补负责人" : null, !task.deadline ? "待补日期" : null, task.aiConfidence && task.aiConfidence !== "HIGH" ? "AI 低置信" : null, task.needsConfirmation ? "待确认" : null].filter((item): item is string => Boolean(item)); return signals.length ? <div className="flex flex-wrap gap-1">{signals.map((signal) => <span key={signal} className={signal === "已逾期" ? "rounded border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive" : "rounded border border-warning/25 bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning"}>{signal}</span>)}</div> : <span className="text-xs text-muted-foreground">正常</span>; }

function ControlItemQuickAdd({ projectId, phases, onComplete }: { projectId: string; phases: PhaseOption[]; onComplete: () => void }) { const [name, setName] = useState(""); const [assignee, setAssignee] = useState(""); const [deadline, setDeadline] = useState(""); const [phaseName, setPhaseName] = useState(""); const [description, setDescription] = useState(""); const [expanded, setExpanded] = useState(false); const [creating, setCreating] = useState(false); async function submit(event: React.FormEvent) { event.preventDefault(); if (!name.trim() || creating) return; setCreating(true); const formData = new FormData(); formData.set("projectId", projectId); formData.set("name", name); formData.set("assignee", assignee); formData.set("deadline", deadline); formData.set("phaseName", phaseName); formData.set("description", description); try { const result = await createTask(formData); if (!result.success) toast.error(result.message ?? "添加失败"); else { setName(""); setAssignee(""); setDeadline(""); setPhaseName(""); setDescription(""); onComplete(); } } catch { toast.error("添加失败"); } finally { setCreating(false); } } return <form onSubmit={submit} className="border-y border-primary/20 bg-primary/[0.035] px-3 py-3"><div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_150px_auto]"><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="事项名称" className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /><input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="负责人" className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /><input value={deadline} onChange={(event) => setDeadline(event.target.value)} type="date" className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /><Button type="submit" size="sm" className="h-9" disabled={creating}>{creating ? <Loader2 className="size-3.5 animate-spin" /> : "添加"}</Button></div><div className="mt-2 flex items-center gap-3"><button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setExpanded((value) => !value)}>更多字段 <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} /></button><span className="text-[11px] text-muted-foreground">名称、负责人、截止日期之外的信息可稍后再补。</span></div>{expanded && <div className="mt-2 grid gap-2 md:grid-cols-2"><input list="phase-options" value={phaseName} onChange={(event) => setPhaseName(event.target.value)} placeholder="模块" className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="事项说明" className="h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /><datalist id="phase-options">{phases.map((phase) => <option key={phase.id} value={phase.name} />)}</datalist></div>}</form>; }

function ControlItemDetailSheet({ task, phases, canEdit, onOpenChange, onDelete }: { task: Task | null; phases: PhaseOption[]; canEdit: boolean; onOpenChange: (open: boolean) => void; onDelete: () => void }) { const router = useRouter(); const [progress, setProgress] = useState(""); const [saving, setSaving] = useState(false); if (!task) return null; const taskId = task.id; const phaseName = phases.find((phase) => phase.id === task.phaseId)?.name ?? "未分模块"; async function recordProgress() { if (!progress.trim() || saving) return; setSaving(true); const formData = new FormData(); formData.set("taskId", taskId); formData.set("content", progress.trim()); formData.set("syncTaskNotes", "on"); try { const result = await addProgressLog(formData); if (!result.success) toast.error(result.message ?? "记录失败"); else { setProgress(""); router.refresh(); } } catch { toast.error("记录失败"); } finally { setSaving(false); } } return <Sheet open onOpenChange={onOpenChange}><SheetContent><SheetHeader title={task.name} description={`${phaseName} · ${TASK_STATUS_MAP[task.status]}`} /><div className="flex-1 space-y-5 overflow-y-auto px-5 py-5"><section className="space-y-3"><DetailRow label="事项说明" value={task.description || "暂无说明"} /><DetailRow label="负责人" value={task.assignee || "待补负责人"} /><DetailRow label="部门" value={task.department || "待补部门"} /><DetailRow label="截止日期" value={task.deadline ? formatDate(task.deadline) : "待补日期"} /><DetailRow label="优先级" value={task.priority} /><DetailRow label="当前结论" value={task.notes || "暂无进展"} /></section><section className="border-t border-border pt-4"><h3 className="text-sm font-semibold">关联信息</h3><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-muted-foreground">执行日历</p><p className="mt-1 font-medium">{task._count.calendarEntries} 个节点</p></div><div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-muted-foreground">进展记录</p><p className="mt-1 font-medium">{task._count.logs} 条</p></div></div></section><section className="border-t border-border pt-4"><h3 className="text-sm font-semibold">最近进展</h3><div className="mt-3 space-y-2">{task.logs.length ? task.logs.map((log) => <div key={log.id} className="border-l-2 border-border pl-3"><p className="text-xs leading-5">{log.content}</p><p className="mt-1 text-[11px] text-muted-foreground">{log.createdBy} · {formatDateTime(log.createdAt)}</p></div>) : <p className="text-xs text-muted-foreground">尚无进展记录。</p>}</div>{canEdit && <div className="mt-4 space-y-2"><textarea value={progress} onChange={(event) => setProgress(event.target.value)} placeholder="补充一次进展，自动写入活动记录和最新进展" rows={3} className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /><div className="flex justify-end"><Button size="sm" disabled={saving || !progress.trim()} onClick={recordProgress}>{saving ? "记录中" : "记录进展"}</Button></div></div>}</section>{canEdit && <section className="border-t border-border pt-4"><Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}><Trash2 className="size-3.5" />删除事项</Button></section>}</div></SheetContent></Sheet>; }

function DetailRow({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value}</p></div>; }
function DeleteTaskDialog({ task, onOpenChange, onDeleted }: { task: Task | null; onOpenChange: (open: boolean) => void; onDeleted: () => void }) { const [deleting, setDeleting] = useState(false); if (!task) return null; const taskId = task.id; async function confirm() { setDeleting(true); try { const result = await deleteTask(taskId); if (!result.success) toast.error(result.message ?? "删除失败"); else onDeleted(); } catch { toast.error("删除失败"); } finally { setDeleting(false); } } return <Dialog open onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>删除管控事项</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">删除「{task.name}」后，关联执行节点会一并删除；项目活动会保留删除事实，预算项不会被自动删除。</p><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button><Button variant="destructive" disabled={deleting} onClick={confirm}>{deleting ? "删除中" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog>; }
function taskFormData(task: Task) { const formData = new FormData(); formData.set("taskId", task.id); formData.set("name", task.name); formData.set("assignee", task.assignee ?? ""); formData.set("department", task.department ?? ""); formData.set("deadline", toDateInput(task.deadline)); formData.set("description", task.description ?? ""); formData.set("notes", task.notes ?? ""); formData.set("priority", task.priority); formData.set("status", task.status); return formData; }
function matchesFilter(task: Task, filter: Filter, viewerName: string) { if (filter === "ALL") return true; if (filter === "MINE") return task.assignee === viewerName && task.status !== "COMPLETED"; if (filter === "OVERDUE") return isOverdue(task); if (filter === "THIS_WEEK") { if (!task.deadline || task.status === "COMPLETED") return false; const date = new Date(task.deadline); const now = new Date(); const end = new Date(now); end.setDate(end.getDate() + 7); return date >= now && date <= end; } return !task.assignee || !task.deadline || Boolean(task.needsConfirmation); }
function matchesQuery(task: Task, query: string) { const value = query.trim().toLowerCase(); return !value || [task.name, task.description, task.assignee, task.department, task.notes].some((item) => item?.toLowerCase().includes(value)); }
function isOverdue(task: Task) { if (!task.deadline || task.status === "COMPLETED") return false; const date = new Date(task.deadline); date.setHours(23, 59, 59, 999); return date < new Date(); }
function toDateInput(value: Date | string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
function formatDate(value: Date | string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDateTime(value: Date | string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function isTyping(target: EventTarget | null) { return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName); }
function isFilter(value: string | null): value is Filter { return value === "ALL" || value === "MINE" || value === "OVERDUE" || value === "THIS_WEEK" || value === "MISSING"; }
