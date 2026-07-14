"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createProject } from "@/actions/project-actions";
import { AIProjectCreator } from "@/components/project/AIProjectPreview";

type BudgetMode = "CONFIRMED" | "PENDING" | "NOT_MANAGED";
type InitialBudgetItem = { title: string; plannedAmount: string; category: string; description: string };

const EMPTY_ITEM = (): InitialBudgetItem => ({ title: "", plannedAmount: "", category: "", description: "" });

export function CreateProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("PENDING");
  const [totalBudget, setTotalBudget] = useState("");
  const [setUpItemsNow, setSetUpItemsNow] = useState(false);
  const [budgetItems, setBudgetItems] = useState<InitialBudgetItem[]>([]);

  const plannedAmount = budgetItems.reduce((sum, item) => sum + (Number(item.plannedAmount) || 0), 0);
  const confirmedTotal = Number(totalBudget) || 0;
  const remaining = confirmedTotal - plannedAmount;

  function resetManual() {
    setStep(1);
    setName("");
    setStartDate("");
    setEndDate("");
    setBudgetMode("PENDING");
    setTotalBudget("");
    setSetUpItemsNow(false);
    setBudgetItems([]);
  }

  function updateBudgetItem(index: number, patch: Partial<InitialBudgetItem>) {
    setBudgetItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function goToBudgetSetup() {
    if (!name.trim()) {
      toast.error("请先填写项目名称");
      return;
    }
    if (budgetMode === "CONFIRMED" && confirmedTotal <= 0) {
      toast.error("已有明确预算时，请填写大于 0 的项目总预算");
      return;
    }
    setStep(2);
  }

  async function handleManualCreate() {
    const validItems = budgetItems.filter((item) => item.title.trim() || item.plannedAmount.trim());
    if (validItems.some((item) => !item.title.trim() || !(Number(item.plannedAmount) > 0))) {
      toast.error("每条预算项都需要名称和大于 0 的计划金额");
      return;
    }
    if (budgetMode === "CONFIRMED" && plannedAmount > confirmedTotal) {
      toast.error("已编排预算不能超过项目总预算");
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("budgetMode", budgetMode);
    formData.set("totalBudget", budgetMode === "CONFIRMED" ? totalBudget : "0");
    formData.set("budgetItemsJson", JSON.stringify(validItems));

    setLoading(true);
    try {
      const result = await createProject(formData);
      if (!result.success || !result.data?.projectId) {
        toast.error(result.message ?? "创建失败，请重试");
        return;
      }
      toast.success(result.message ?? "项目已创建");
      resetManual();
      setOpen(false);
      router.push(`/projects/${result.data.projectId}`);
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

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetManual(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>

          <div className="flex rounded-xl border border-border bg-secondary/70 p-1 -mx-1">
            <button onClick={() => setMode("ai")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${mode === "ai" ? "border border-primary/20 bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Sparkles className="size-3.5" />AI 生成
            </button>
            <button onClick={() => setMode("manual")} className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${mode === "manual" ? "border border-primary/20 bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <PenLine className="size-3.5" />手动创建
            </button>
          </div>

          {mode === "ai" ? <AIProjectCreator onClose={() => setOpen(false)} /> : (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={step === 1 ? "rounded-full bg-primary px-2 py-0.5 text-primary-foreground" : "rounded-full bg-secondary px-2 py-0.5"}>1 基本信息</span>
                <span className="h-px w-5 bg-border" />
                <span className={step === 2 ? "rounded-full bg-primary px-2 py-0.5 text-primary-foreground" : "rounded-full bg-secondary px-2 py-0.5"}>2 预算项设置</span>
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">项目名称 <span className="text-destructive">*</span></label>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：U7 海外整合营销" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" autoFocus />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">开始日期<input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>
                    <label className="block text-sm font-medium">结束日期<input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>
                  </div>
                  <div className="rounded-lg border border-border bg-canvas/30 px-3 py-2.5 text-sm"><span className="text-muted-foreground">项目负责人</span><span className="ml-3 font-medium">当前登录用户</span></div>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">预算状态 <span className="text-destructive">*</span></legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([
                        ["CONFIRMED", "已有明确预算", "确认总预算后可编排预算项"],
                        ["PENDING", "预算待确认", "项目照常创建，稍后启用预算"],
                        ["NOT_MANAGED", "本项目不管理预算", "不显示金额或预算操作"],
                      ] as const).map(([value, label, description]) => (
                        <button key={value} type="button" onClick={() => setBudgetMode(value)} className={`rounded-lg border p-3 text-left transition-colors ${budgetMode === value ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50"}`}>
                          <p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs leading-4 text-muted-foreground">{description}</p>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {budgetMode === "CONFIRMED" && <label className="block text-sm font-medium">项目总预算 (¥)<input value={totalBudget} onChange={(event) => setTotalBudget(event.target.value.replace(/,/g, ""))} inputMode="decimal" placeholder="例如：3500000" className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" /></label>}
                  <div className="flex justify-end"><Button onClick={goToBudgetSetup}>下一步</Button></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {budgetMode === "CONFIRMED" ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
                        <div><p className="text-sm font-medium">是否现在录入预算项？</p><p className="mt-1 text-xs text-muted-foreground">预算项可先独立保存，管控事项创建后再关联。</p></div>
                        <div className="flex rounded-md border border-border p-0.5 text-xs"><button onClick={() => setSetUpItemsNow(true)} className={`rounded px-2.5 py-1.5 ${setUpItemsNow ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>现在添加</button><button onClick={() => setSetUpItemsNow(false)} className={`rounded px-2.5 py-1.5 ${!setUpItemsNow ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>稍后添加</button></div>
                      </div>
                      {setUpItemsNow && <>
                        <div className="overflow-hidden rounded-lg border border-border">
                          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_120px_minmax(0,1fr)_32px] gap-2 border-b border-border bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground"><span>预算项</span><span>计划金额</span><span>分类</span><span>说明</span><span /></div>
                          {budgetItems.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1.4fr)_120px_120px_minmax(0,1fr)_32px] gap-2 border-b border-border px-3 py-2 last:border-b-0"><input value={item.title} onChange={(event) => updateBudgetItem(index, { title: event.target.value })} placeholder="例如：媒体投放" className="min-w-0 bg-transparent text-sm outline-none" /><input value={item.plannedAmount} onChange={(event) => updateBudgetItem(index, { plannedAmount: event.target.value.replace(/,/g, "") })} inputMode="decimal" placeholder="0" className="min-w-0 bg-transparent font-mono text-sm outline-none" /><input value={item.category} onChange={(event) => updateBudgetItem(index, { category: event.target.value })} placeholder="传播" className="min-w-0 bg-transparent text-sm outline-none" /><input value={item.description} onChange={(event) => updateBudgetItem(index, { description: event.target.value })} placeholder="可选" className="min-w-0 bg-transparent text-sm outline-none" /><button onClick={() => setBudgetItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-muted-foreground hover:text-destructive" title="删除预算项"><Trash2 className="size-4" /></button></div>)}
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setBudgetItems((items) => [...items, EMPTY_ITEM()])}><Plus className="size-3.5" />添加预算项</Button>
                      </>}
                      <div className={`grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-3 ${remaining < 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-canvas/30"}`}><div><p className="text-xs text-muted-foreground">项目总预算</p><p className="mt-1 font-mono font-medium">¥{confirmedTotal.toLocaleString("zh-CN")}</p></div><div><p className="text-xs text-muted-foreground">已编排预算</p><p className="mt-1 font-mono font-medium">¥{plannedAmount.toLocaleString("zh-CN")}</p></div><div><p className="text-xs text-muted-foreground">剩余可分配</p><p className={`mt-1 font-mono font-medium ${remaining < 0 ? "text-destructive" : ""}`}>¥{remaining.toLocaleString("zh-CN")}</p></div></div>
                    </>
                  ) : <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{budgetMode === "PENDING" ? "项目会以“预算待确认”创建，可在预算页确认总预算后开始规划。" : "该项目不会显示预算指标或预算操作，后续仍可启用预算管理。"}</div>}
                  <div className="flex justify-between gap-3 border-t pt-3"><Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5"><ArrowLeft className="size-4" />上一步</Button><Button onClick={handleManualCreate} disabled={loading || remaining < 0} className="gap-2">{loading && <Loader2 className="size-4 animate-spin" />}创建项目</Button></div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
