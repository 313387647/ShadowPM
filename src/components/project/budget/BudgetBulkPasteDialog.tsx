"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseBudgetDocument } from "@/actions/ai-actions";
import { createBudgetItems } from "@/actions/budget-item-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseBudgetPaste, parseBudgetSheetRows, type ParsedBudgetItem } from "@/lib/budget-import";

type ImportSource = "MANUAL" | "AI_IMPORT";
type ReviewItem = ParsedBudgetItem & { selected: boolean; source: ImportSource; sourceRef?: string | null; aiConfidence?: string | null };

export function BudgetBulkPasteDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [mode, setMode] = useState<"paste" | "sheet" | "ai">("paste");
  const [loading, setLoading] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const sheetFileRef = useRef<HTMLInputElement>(null);
  const selectedTotal = useMemo(() => items.filter((item) => item.selected).reduce((sum, item) => sum + item.plannedAmount, 0), [items]);

  function reviewParsed(result: ReturnType<typeof parseBudgetPaste>, source: ImportSource = "MANUAL") {
    if (result.invalidLines.length) toast.warning(`第 ${result.invalidLines.join("、")} 行格式无法识别，已跳过。`);
    if (!result.items.length) {
      toast.error("未识别到有效预算项。请使用“名称 + Tab + 金额”的格式。");
      return;
    }
    setItems(result.items.map((item) => ({ ...item, selected: true, source })));
  }

  async function readSheet(file: File) {
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
      reviewParsed(parseBudgetSheetRows(rows));
    } catch {
      toast.error("Excel 读取失败，请改用 .xlsx / .xls 或批量粘贴。");
    } finally {
      setLoading(false);
    }
  }

  async function readAIFile(file: File) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await parseBudgetDocument(formData);
      if (!result.success || !result.data) {
        toast.error(result.message ?? "AI 预算解析失败");
        return;
      }
      setItems(result.data.items.map((item) => ({
        title: item.title,
        plannedAmount: item.amount ?? 0,
        category: item.workstream ?? item.type ?? null,
        description: item.description ?? null,
        sourceRef: item.sourceRef ?? null,
        aiConfidence: item.confidence ?? null,
        selected: item.confidence === "high" && (item.conflicts?.length ?? 0) === 0,
        source: "AI_IMPORT" as const,
      })).filter((item) => item.plannedAmount > 0));
      toast.success(result.message ?? "AI 预算候选已生成，请确认后写入草稿。");
    } catch {
      toast.error("AI 预算解析失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const selected = items.filter((item) => item.selected);
    if (!selected.length) {
      toast.error("请至少选择一条预算项。");
      return;
    }
    setLoading(true);
    try {
      const result = await createBudgetItems({
        projectId,
        items: selected.map((item) => ({
          title: item.title,
          plannedAmount: item.plannedAmount,
          category: item.category ?? null,
          description: item.description ?? null,
          source: item.source,
          sourceRef: item.sourceRef ?? null,
          aiConfidence: item.aiConfidence ?? null,
        })),
      });
      if (!result.success) {
        toast.error(result.message ?? "批量保存失败");
        return;
      }
      toast.success(result.message ?? "预算草稿已保存");
      setOpen(false);
      setItems([]);
      setText("");
    } catch {
      toast.error("批量保存失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOpen(true)}><Upload className="size-3.5" />批量导入</Button>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setItems([]); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>批量导入预算项</DialogTitle><DialogDescription>导入结果先进入草稿，不会自动确认或产生资金流水。</DialogDescription></DialogHeader>
        <div className="mt-4 flex gap-1 border-b border-border pb-2 text-sm">
          {(["paste", "sheet", "ai"] as const).map((option) => <button key={option} type="button" onClick={() => setMode(option)} className={mode === option ? "rounded-md bg-primary/10 px-3 py-1.5 font-medium text-primary" : "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary"}>{option === "paste" ? "批量粘贴" : option === "sheet" ? "Excel 导入" : "AI 识别文件"}</button>)}
        </div>
        {mode === "paste" && <div className="space-y-3"><textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder={"媒体投放\t1500000\n内容制作\t800000\n发布会执行\t1200000"} className="form-input resize-none font-mono text-sm" /><Button type="button" variant="outline" onClick={() => reviewParsed(parseBudgetPaste(text))}>解析粘贴内容</Button></div>}
        {mode === "sheet" && <div className="rounded-lg border border-dashed border-border p-6 text-center"><FileSpreadsheet className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">导入 Excel 预算表</p><p className="mt-1 text-xs text-muted-foreground">读取首个工作表，前三列按名称、分类、金额识别。</p><input ref={sheetFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readSheet(file); }} /><Button type="button" variant="outline" className="mt-4 gap-1.5" onClick={() => sheetFileRef.current?.click()}><Upload className="size-3.5" />选择 Excel 文件</Button></div>}
        {mode === "ai" && <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center"><Sparkles className="mx-auto size-6 text-primary" /><p className="mt-2 text-sm font-medium">识别预算文件</p><p className="mt-1 text-xs text-muted-foreground">支持 docx、pdf、xlsx、txt。高置信且无冲突项才会默认选中。</p><input ref={aiFileRef} type="file" accept=".docx,.pdf,.xlsx,.xls,.txt,.md" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readAIFile(file); }} /><Button type="button" variant="outline" className="mt-4 gap-1.5" onClick={() => aiFileRef.current?.click()}><Sparkles className="size-3.5" />选择并识别文件</Button></div>}
        {items.length > 0 && <div className="max-h-64 overflow-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2"><input aria-label="全选预算项" type="checkbox" checked={items.every((item) => item.selected)} onChange={(event) => setItems((current) => current.map((item) => ({ ...item, selected: event.target.checked })))} /></th><th className="px-3 py-2">预算项</th><th className="px-3 py-2">分类</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2">来源</th></tr></thead><tbody className="divide-y divide-border">{items.map((item, index) => <tr key={`${item.title}-${index}`}><td className="px-3 py-2"><input aria-label={`选择 ${item.title}`} type="checkbox" checked={item.selected} onChange={(event) => setItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, selected: event.target.checked } : candidate))} /></td><td className="px-3 py-2 font-medium">{item.title}</td><td className="px-3 py-2 text-muted-foreground">{item.category ?? "-"}</td><td className="px-3 py-2 text-right font-mono">¥{item.plannedAmount.toLocaleString("zh-CN")}</td><td className="px-3 py-2 text-xs text-muted-foreground">{item.source === "AI_IMPORT" ? `AI ${item.aiConfidence ?? ""}` : "批量录入"}</td></tr>)}</tbody></table></div>}
        <DialogFooter><span className="mr-auto self-center text-xs text-muted-foreground">已选择 {items.filter((item) => item.selected).length} 条 · ¥{selectedTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span><Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button type="button" disabled={loading || !items.length} onClick={() => void save()} className="gap-1.5">{loading && <Loader2 className="size-3.5 animate-spin" />}写入预算草稿</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
