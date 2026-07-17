"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPhase, deletePhase, updatePhase } from "@/actions/phase-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";

type Phase = { id: string; name: string; _count?: { tasks: number } };

export function PhaseManagerSheet({ projectId, phases, open, onOpenChange }: { projectId: string; phases: Phase[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [deleteTarget, setDeleteTarget] = useState<Phase | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function addPhase(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("name", newName);
    const result = await createPhase(formData);
    setCreating(false);
    if (!result.success) return toast.error(result.message ?? "创建模块失败");
    setNewName("");
  }

  return <><Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="max-w-lg"><SheetHeader title="管理模块" description="模块用于组织管控事项；改名不会影响事项、预算或日历关联。" /><div className="flex-1 overflow-y-auto p-5"><div className="divide-y divide-border border-y border-border">{phases.length ? phases.map((phase) => <PhaseRow key={phase.id} phase={phase} onDelete={() => setDeleteTarget(phase)} />) : <p className="py-6 text-sm text-muted-foreground">尚未设置模块。可以直接创建，或在新增事项时填写模块。</p>}</div><form onSubmit={addPhase} className="mt-4 flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="新模块名称" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /><Button type="submit" size="sm" disabled={creating || !newName.trim()}>{creating ? <Loader2 className="size-3.5 animate-spin" /> : <><Plus className="mr-1 size-3.5" />添加</>}</Button></form></div></SheetContent></Sheet><DeletePhaseDialog phase={deleteTarget} onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)} /></>;
}

function PhaseRow({ phase, onDelete }: { phase: Phase; onDelete: () => void }) {
  const [name, setName] = useState(phase.name);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (name.trim() === phase.name || saving) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("phaseId", phase.id);
    formData.set("name", name);
    const result = await updatePhase(formData);
    setSaving(false);
    if (!result.success) { setName(phase.name); toast.error(result.message ?? "保存失败"); }
  }
  return <div className="flex items-center gap-2 py-2.5"><input value={name} disabled={saving} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape") setName(phase.name); }} onBlur={() => void save()} className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-border focus:border-primary focus:bg-background" /><span className="shrink-0 text-xs text-muted-foreground">{phase._count?.tasks ?? 0} 项</span><Button type="button" size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={onDelete} aria-label={`删除模块 ${phase.name}`}><Trash2 className="size-3.5" /></Button></div>;
}

function DeletePhaseDialog({ phase, onOpenChange }: { phase: Phase | null; onOpenChange: (open: boolean) => void }) {
  const [deleting, setDeleting] = useState(false);
  if (!phase) return null;
  const target = phase;
  async function confirm() { setDeleting(true); const result = await deletePhase(target.id); setDeleting(false); if (!result.success) return toast.error(result.message ?? "删除模块失败"); onOpenChange(false); }
  return <Dialog open onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>删除模块</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">删除「{target.name}」后，{target._count?.tasks ?? 0} 条事项会保留，但改为未分模块。预算、日历和活动记录不会删除。</p><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button><Button variant="destructive" disabled={deleting} onClick={confirm}>{deleting ? "删除中" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog>;
}
