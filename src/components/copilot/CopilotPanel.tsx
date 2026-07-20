"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { processCopilotMessage, type CopilotResponse } from "@/actions/copilot-actions";

const SUGGESTIONS = ["有哪些事项需要我处理", "接下来有哪些执行节点", "我的项目预算还有多少"];

export function CopilotPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); } };
    window.addEventListener("shadowpm:open-command", openPanel);
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("shadowpm:open-command", openPanel); window.removeEventListener("keydown", shortcut); };
  }, []);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  async function submit(nextQuery = query) { const text = nextQuery.trim(); if (!text || loading) return; setQuery(text); setLoading(true); try { setResult(await processCopilotMessage(text)); } catch { setResult({ message: "暂时无法完成查询，请稍后重试。" }); } finally { setLoading(false); } }
  function close() { setOpen(false); setResult(null); setQuery(""); }

  return <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}>
    <DialogContent className="top-[12vh] max-w-2xl translate-y-0 p-0 sm:top-[12vh] sm:translate-y-0">
      <DialogTitle className="sr-only">Command Center</DialogTitle>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-4 text-primary" />
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} placeholder="搜索项目、事项、预算或执行节点" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
      </div>
      {!result && !loading && <div className="p-4"><p className="text-xs text-muted-foreground">快速查询</p><div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => void submit(item)} className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground">{item}</button>)}</div></div>}
      {loading && <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在查询正式项目数据…</div>}
      {result && !loading && <div className="p-4"><p className="whitespace-pre-wrap text-sm leading-6">{result.message}</p>{result.actions?.length ? <div className="mt-4 flex flex-wrap gap-2">{result.actions.map((action) => <Button key={action.href} size="sm" variant="outline" onClick={() => { close(); router.push(action.href); }}>{action.label}</Button>)}</div> : null}</div>}
    </DialogContent>
  </Dialog>;
}
