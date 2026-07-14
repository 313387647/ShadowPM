"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return <>{<button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-30 flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-surface-elevated px-3 text-xs font-medium text-foreground shadow-[0_14px_36px_rgba(0,5,18,0.42)] md:hidden" title="Command Center"><Command className="size-4" />Command</button>}{open && <div className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/75 p-4 pt-[12vh] backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label="Command Center" className="w-full max-w-2xl overflow-hidden rounded-xl border border-primary/20 bg-surface-elevated shadow-[0_28px_80px_rgba(0,5,18,0.56)]"><div className="flex items-center gap-2 border-b border-border px-3 py-2"><Search className="size-4 text-primary" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); if (event.key === "Escape") close(); }} placeholder="搜索项目、事项、预算或执行节点" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" /><kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd><Button variant="ghost" size="icon" className="size-8" onClick={close} aria-label="关闭 Command Center"><X className="size-4" /></Button></div>{!result && !loading && <div className="p-3"><p className="px-1 text-xs text-muted-foreground">快速查询</p><div className="mt-2 flex flex-wrap gap-2">{SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => void submit(item)} className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/35 hover:text-foreground">{item}</button>)}</div></div>}{loading && <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在查询正式项目数据…</div>}{result && !loading && <div className="p-4"><p className="whitespace-pre-wrap text-sm leading-6">{result.message}</p>{result.actions?.length ? <div className="mt-4 flex flex-wrap gap-2">{result.actions.map((action) => <Button key={action.href} size="sm" variant="outline" onClick={() => { close(); router.push(action.href); }}>{action.label}</Button>)}</div> : null}</div>}</section></div>}</>;
}
