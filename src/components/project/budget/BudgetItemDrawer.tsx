"use client";

import { useEffect, useState } from "react";
import { Check, CircleDollarSign, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { recordBudgetFlow } from "@/actions/budget-flow-actions";
import { deleteDraftBudgetItem, updateBudgetItem } from "@/actions/budget-item-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { formatBudgetMoney } from "./BudgetOverview";

type TaskOption = { id: string; name: string };
type BudgetItem = {
  id: string; title: string; category: string | null; plannedAmount: number; actualSpend: number; remaining: number;
  status: "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "SETTLED" | "CANCELED"; description: string | null; source: string;
  aiConfidence: string | null; sourceRef: string | null; createdBy: string; updatedAt: string; taskIds: string[]; taskNames: string[];
};
type Flow = { id: string; budgetItemId: string | null; action: string | null; amount: number; counterparty: string | null; description: string; createdBy: string; createdAt: string };
type DrawerTab = "overview" | "actions" | "history";

const STATUS_LABEL: Record<BudgetItem["status"], string> = { DRAFT: "草稿", CONFIRMED: "已确认", IN_PROGRESS: "执行中", SETTLED: "已结算", CANCELED: "已取消" };

export function BudgetItemDrawer({ item, flows, tasks, canEdit, canManage, open, onOpenChange }: { item: BudgetItem | null; flows: Flow[]; tasks: TaskOption[]; canEdit: boolean; canManage: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [submitting, setSubmitting] = useState(false);
  const [flowAction, setFlowAction] = useState("EXPENSE_RECORDED");
  const [showCancel, setShowCancel] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  useEffect(() => { if (open) { setTab("overview"); setShowCancel(false); setShowDelete(false); } }, [item?.id, open]);
  if (!item) return null;
  const currentItem = item;
  const itemFlows = flows.filter((flow) => flow.budgetItemId === currentItem.id);

  async function saveItem(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await updateBudgetItem(formData);
      if (!result.success) { toast.error(result.message ?? "预算项更新失败"); return; }
      toast.success(result.message ?? "预算项已更新");
      onOpenChange(false);
    } catch { toast.error("预算项更新失败，请重试"); } finally { setSubmitting(false); }
  }

  async function saveFlow(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await recordBudgetFlow(formData);
      if (!result.success) { toast.error(result.message ?? "资金动作保存失败"); return; }
      toast.success(result.message ?? "资金动作已记录");
      onOpenChange(false);
    } catch { toast.error("资金动作保存失败，请重试"); } finally { setSubmitting(false); }
  }

  async function deleteDraft() {
    setSubmitting(true);
    try {
      const result = await deleteDraftBudgetItem(currentItem.id);
      if (!result.success) { toast.error(result.message ?? "删除失败"); return; }
      toast.success(result.message ?? "草稿预算项已删除");
      setShowDelete(false);
      onOpenChange(false);
    } catch { toast.error("删除失败，请重试"); } finally { setSubmitting(false); }
  }

  const staticFields = <>{item.taskIds.map((taskId) => <input key={taskId} type="hidden" name="taskIds" value={taskId} />)}<input type="hidden" name="budgetItemId" value={item.id} /><input type="hidden" name="title" value={item.title} /><input type="hidden" name="plannedAmount" value={item.plannedAmount} /><input type="hidden" name="category" value={item.category ?? ""} /><input type="hidden" name="description" value={item.description ?? ""} /></>;

  return <><Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="max-w-2xl"><div className="shrink-0"><SheetHeader title={item.title} /><div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 sm:px-6"><Badge variant="outline">{STATUS_LABEL[item.status]}</Badge><div className="flex items-center gap-2">{canManage && item.status === "DRAFT" && <form onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); formData.set("status", "CONFIRMED"); void saveItem(formData); }}>{staticFields}<Button type="submit" size="sm" disabled={submitting} className="gap-1.5"><Check className="size-3.5" />确认</Button></form>}{canManage && item.status !== "DRAFT" && item.status !== "CANCELED" && <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setShowCancel(true)}>取消预算项</Button>}{canEdit && item.status === "DRAFT" && <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" title="删除草稿预算项" onClick={() => setShowDelete(true)}><Trash2 className="size-3.5" /></Button>}</div></div><div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center"><Metric label="计划金额" value={formatBudgetMoney(item.plannedAmount)} /><Metric label="实际支出" value={formatBudgetMoney(item.actualSpend)} /><Metric label="剩余" value={formatBudgetMoney(item.remaining)} /></div><div className="flex gap-5 border-b border-border px-5 sm:px-6">{([ ["overview", "概况"], ["actions", "资金动作"], ["history", "历史"] ] as const).map(([key, label]) => <Button key={key} type="button" variant="ghost" onClick={() => setTab(key)} className={tab === key ? "h-10 rounded-none border-b-2 border-primary px-0 text-primary hover:bg-transparent hover:text-primary" : "h-10 rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"}>{label}</Button>)}</div></div>
    <div className="min-h-0 flex-1 overflow-y-auto">{tab === "overview" && <Overview item={item} tasks={tasks} canEdit={canEdit} submitting={submitting} onSave={saveItem} />}{tab === "actions" && <Actions item={item} canEdit={canEdit} flowAction={flowAction} setFlowAction={setFlowAction} submitting={submitting} onSave={saveFlow} />}{tab === "history" && <History item={item} flows={itemFlows} />}</div>
    {showCancel && <form className="border-t border-destructive/25 px-5 py-4 sm:px-6" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); formData.set("status", "CANCELED"); void saveItem(formData); }}>{staticFields}<div className="flex flex-wrap items-end gap-2"><label className="min-w-[220px] flex-1 space-y-1"><span className="text-xs text-destructive">取消原因</span><input name="reason" required placeholder="例如：项目取消，释放该预算项" className="form-input h-9" /></label><Button type="button" size="sm" variant="ghost" onClick={() => setShowCancel(false)}>返回</Button><Button type="submit" size="sm" variant="destructive" disabled={submitting} className="gap-1.5"><XCircle className="size-3.5" />确认取消</Button></div></form>}</SheetContent></Sheet>
    <Dialog open={showDelete} onOpenChange={setShowDelete}><DialogContent><DialogHeader><DialogTitle>删除草稿预算项</DialogTitle></DialogHeader><p className="text-sm leading-6 text-muted-foreground">删除「{item.title}」只会移除草稿预算项，项目活动会保留删除事实。</p><DialogFooter><Button variant="ghost" onClick={() => setShowDelete(false)}>取消</Button><Button variant="destructive" disabled={submitting} onClick={() => void deleteDraft()}>{submitting ? "删除中" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog></>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-medium tabular-nums">{value}</p></div>; }

function Overview({ item, tasks, canEdit, submitting, onSave }: { item: BudgetItem; tasks: TaskOption[]; canEdit: boolean; submitting: boolean; onSave: (formData: FormData) => Promise<void> }) {
  if (!canEdit || item.status === "CANCELED") return <div className="space-y-5 px-5 py-5 text-sm sm:px-6"><Field label="分类" value={item.category ?? "未分类"} /><Field label="关联事项" value={item.taskNames.length ? item.taskNames.join("、") : "暂未关联"} /><Field label="说明" value={item.description ?? "暂无说明"} /></div>;
  return <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); void onSave(new FormData(event.currentTarget)); }}><input type="hidden" name="budgetItemId" value={item.id} /><input type="hidden" name="status" value={item.status} /><div className="grid gap-3 sm:grid-cols-2"><FieldInput label="预算项名称" name="title" value={item.title} required /><FieldInput label="计划金额" name="plannedAmount" value={item.plannedAmount} type="number" required /><FieldInput label="分类" name="category" value={item.category ?? ""} /><FieldInput label="修改原因" name="reason" value="" placeholder={item.status === "DRAFT" ? "草稿可不填" : "已确认项的金额改动必填"} /></div><label className="block space-y-1"><span className="text-xs text-muted-foreground">说明</span><textarea name="description" defaultValue={item.description ?? ""} rows={3} className="form-input resize-none" /></label><fieldset><legend className="text-xs text-muted-foreground">关联管控事项（可不选、可多选）</legend><div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{tasks.map((task) => <label key={task.id} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"><input type="checkbox" name="taskIds" value={task.id} defaultChecked={item.taskIds.includes(task.id)} />{task.name}</label>)}</div></fieldset><div className="flex justify-end"><Button type="submit" size="sm" disabled={submitting} className="gap-1.5">{submitting && <Loader2 className="size-3.5 animate-spin" />}保存</Button></div></form>;
}

function Actions({ item, canEdit, flowAction, setFlowAction, submitting, onSave }: { item: BudgetItem; canEdit: boolean; flowAction: string; setFlowAction: (value: string) => void; submitting: boolean; onSave: (formData: FormData) => Promise<void> }) {
  if (!canEdit) return <Empty message="你只有查看权限，不能记录资金动作。" />;
  if (item.status === "DRAFT") return <Empty message="确认预算项后，才能记录报批、划拨、支出、退款和结算。" />;
  if (item.status === "CANCELED") return <Empty message="已取消预算项不能再记录资金动作。" />;
  return <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); void onSave(new FormData(event.currentTarget)); }}><div className="flex items-center gap-2 text-sm font-medium"><CircleDollarSign className="size-4 text-primary" />记录资金动作</div><input type="hidden" name="budgetItemId" value={item.id} /><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs text-muted-foreground">动作</span><select name="action" value={flowAction} onChange={(event) => setFlowAction(event.target.value)} className="form-input h-9"><option value="APPROVAL_RECORDED">报批通过</option><option value="TRANSFER_RECORDED">划拨给第三方</option><option value="EXPENSE_RECORDED">记录实际支出</option><option value="REFUND_RECORDED">记录退款</option><option value="SETTLED">验收并结算</option><option value="REVERSED">撤回上一动作</option></select></label><FieldInput label="金额" name="amount" value="" type="number" required />{flowAction === "TRANSFER_RECORDED" && <div className="sm:col-span-2"><FieldInput label="接收部门或合作方" name="counterparty" value="" required /></div>}</div><label className="block space-y-1"><span className="text-xs text-muted-foreground">说明</span><textarea name="description" required rows={3} placeholder="例如：供应商首付款已审批并支付" className="form-input resize-none" /></label><div className="flex justify-end"><Button type="submit" size="sm" disabled={submitting} className="gap-1.5">{submitting && <Loader2 className="size-3.5 animate-spin" />}记录动作</Button></div></form>;
}

function History({ item, flows }: { item: BudgetItem; flows: Flow[] }) { return <div className="divide-y divide-border"><div className="px-5 py-4 text-xs text-muted-foreground sm:px-6"><p>创建人：{item.createdBy}</p><p className="mt-1">最近更新：{new Date(item.updatedAt).toLocaleString("zh-CN")}</p>{item.source === "AI_IMPORT" && <p className="mt-1">AI 来源：{item.sourceRef ?? "未定位"} · 置信度：{item.aiConfidence ?? "未标注"}</p>}</div>{flows.length ? flows.map((flow) => <div key={flow.id} className="px-5 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{flow.action ?? "资金动作"}</p><p className="font-mono text-sm tabular-nums">{formatBudgetMoney(flow.amount)}</p></div><p className="mt-1 text-xs text-muted-foreground">{flow.description}{flow.counterparty ? ` · ${flow.counterparty}` : ""}</p><p className="mt-1 text-[11px] text-muted-foreground">{flow.createdBy} · {new Date(flow.createdAt).toLocaleString("zh-CN")}</p></div>) : <Empty message="尚无资金动作记录。" />}</div>; }

function Field({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 leading-6">{value}</p></div>; }
function FieldInput({ label, name, value, type = "text", required = false, placeholder }: { label: string; name: string; value: string | number; type?: string; required?: boolean; placeholder?: string }) { return <label className="space-y-1"><span className="text-xs text-muted-foreground">{label}</span><input name={name} type={type} min={type === "number" ? "0.01" : undefined} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} placeholder={placeholder} className="form-input h-9" /></label>; }
function Empty({ message }: { message: string }) { return <p className="px-5 py-10 text-center text-sm leading-6 text-muted-foreground sm:px-6">{message}</p>; }
