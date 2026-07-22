"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { createProject } from "@/actions/project-actions";
import { AIProjectCreator } from "@/components/project/AIProjectPreview";

type BudgetMode = "CONFIRMED" | "PENDING" | "NOT_MANAGED";
type InitialBudgetItem = { title: string; plannedAmount: string; category: string; description: string };

const EMPTY_ITEM = (): InitialBudgetItem => ({ title: "", plannedAmount: "", category: "", description: "" });

export function NewProjectButton() {
  return <Button asChild className="gap-2"><Link href="/projects/new"><Plus className="size-4" />新建项目</Link></Button>;
}

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("PENDING");
  const [totalBudget, setTotalBudget] = useState("");
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
    if (budgetMode === "CONFIRMED") setStep(2);
    else void handleManualCreate();
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
      router.push(`/projects/${result.data.projectId}`);
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">新建项目</h1>
        </div>
        <Button asChild variant="ghost" size="sm"><Link href="/projects">取消</Link></Button>
      </header>

      <div className="flex gap-5 border-b border-border" role="tablist" aria-label="项目创建方式">
        <button role="tab" aria-selected={mode === "ai"} onClick={() => setMode("ai")} className={mode === "ai" ? "h-10 border-b-2 border-primary text-sm font-medium text-foreground" : "h-10 border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground"}><span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" />AI 生成</span></button>
        <button role="tab" aria-selected={mode === "manual"} onClick={() => setMode("manual")} className={mode === "manual" ? "h-10 border-b-2 border-primary text-sm font-medium text-foreground" : "h-10 border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground"}><span className="inline-flex items-center gap-1.5"><PenLine className="size-3.5" />手动创建</span></button>
      </div>

      {mode === "ai" ? <AIProjectCreator onClose={() => router.push("/projects")} /> : <section className="mx-auto max-w-[720px] space-y-6"><div className="flex gap-5 border-b border-border text-sm"><span className={step === 1 ? "border-b-2 border-primary pb-2 font-medium" : "pb-2 text-muted-foreground"}>1 项目资料</span><span className={step === 2 ? "border-b-2 border-primary pb-2 font-medium" : "pb-2 text-muted-foreground"}>2 预算设置</span></div>{step === 1 ? <div className="space-y-5"><label className="block text-sm font-medium">项目名称 <span className="text-destructive">*</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：U7 海外整合营销" className="mt-1.5" autoFocus /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">开始日期<Input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="mt-1.5" /></label><label className="block text-sm font-medium">结束日期<Input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="mt-1.5" /></label></div><p className="text-sm"><span className="text-muted-foreground">项目负责人</span><span className="ml-3 font-medium">当前登录用户</span></p><fieldset className="space-y-2"><legend className="text-sm font-medium">预算状态 <span className="text-destructive">*</span></legend><div className="grid gap-2 sm:grid-cols-3">{([["CONFIRMED", "已有明确预算", "确认总预算后可编排预算项"], ["PENDING", "预算待确认", "项目照常创建，稍后启用预算"], ["NOT_MANAGED", "本项目不管理预算", "不显示金额或预算操作"]] as const).map(([value, label, description]) => <label key={value} className={budgetMode === value ? "cursor-pointer rounded-lg border border-primary/45 bg-primary/[0.06] p-3" : "cursor-pointer rounded-lg border border-border p-3 hover:bg-surface-2"}><input type="radio" checked={budgetMode === value} onChange={() => setBudgetMode(value)} className="sr-only" /><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></label>)}</div></fieldset>{budgetMode === "CONFIRMED" && <label className="block text-sm font-medium">项目总预算 (¥)<Input value={totalBudget} onChange={(event) => setTotalBudget(event.target.value.replace(/,/g, ""))} inputMode="decimal" placeholder="例如：3500000" className="mt-1.5 font-mono" /></label>}<div className="flex justify-end"><Button onClick={goToBudgetSetup} disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />}{budgetMode === "CONFIRMED" ? "下一步：预算设置" : "创建项目"}</Button></div></div> : <div className="space-y-5">{budgetMode === "CONFIRMED" ? <><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">预算项（可选）</h2><p className="mt-1 text-sm text-muted-foreground">未添加预算项时，也可以直接创建项目。</p></div><Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setBudgetItems((items) => [...items, EMPTY_ITEM()])}><Plus className="size-3.5" />添加预算项</Button></div>{budgetItems.length > 0 && <div className="space-y-2 border-y border-border py-3">{budgetItems.map((item, index) => <div key={index} className="relative grid gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1.4fr)_120px_120px_minmax(0,1fr)_32px]"><Input aria-label={`预算项 ${index + 1} 名称`} value={item.title} onChange={(event) => updateBudgetItem(index, { title: event.target.value })} placeholder="预算项名称" className="h-9" /><Input aria-label={`预算项 ${index + 1} 计划金额`} value={item.plannedAmount} onChange={(event) => updateBudgetItem(index, { plannedAmount: event.target.value.replace(/,/g, "") })} inputMode="decimal" placeholder="计划金额" className="h-9 font-mono" /><Input aria-label={`预算项 ${index + 1} 分类`} value={item.category} onChange={(event) => updateBudgetItem(index, { category: event.target.value })} placeholder="分类" className="h-9" /><Input aria-label={`预算项 ${index + 1} 说明`} value={item.description} onChange={(event) => updateBudgetItem(index, { description: event.target.value })} placeholder="说明（可选）" className="h-9" /><Button type="button" size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive" onClick={() => setBudgetItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`删除预算项 ${index + 1}`}><Trash2 className="size-4" /></Button></div>)}</div>}<div className={remaining < 0 ? "border-y border-destructive/40 py-3 text-sm" : "border-y border-border py-3 text-sm"}><p className="text-muted-foreground">项目总预算 <span className="ml-2 font-mono text-foreground">¥{confirmedTotal.toLocaleString("zh-CN")}</span> · 已编排 <span className="font-mono text-foreground">¥{plannedAmount.toLocaleString("zh-CN")}</span> · <span className={remaining < 0 ? "text-destructive" : "text-muted-foreground"}>剩余 <span className="font-mono">¥{remaining.toLocaleString("zh-CN")}</span></span></p></div></> : <div className="border-y border-border py-8 text-center text-sm text-muted-foreground">{budgetMode === "PENDING" ? "项目将以“预算待确认”创建。" : "本项目不启用预算管理。"}</div>}<div className="sticky bottom-0 flex justify-between gap-3 border-t border-border bg-canvas/95 py-4 backdrop-blur"><Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5"><ArrowLeft className="size-4" />上一步</Button><Button onClick={handleManualCreate} disabled={loading || remaining < 0} className="gap-2">{loading && <Loader2 className="size-4 animate-spin" />}创建项目</Button></div></div>}</section>}
    </main>
  );
}
