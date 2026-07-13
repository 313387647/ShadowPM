"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Send, Loader2, X, ChevronRight, Lightbulb, Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { processCopilotMessage, type CopilotResponse } from "@/actions/copilot-actions";

type Message = {
  role: "user" | "copilot";
  content: string;
  actions?: { label: string; href: string }[];
};

const QUICK_COMMANDS = [
  { label: "Aster X9 预算", query: "Aster X9 国内上市整合传播预算还有多少" },
  { label: "执行日历", query: "Aster X9 国内上市整合传播接下来有哪些执行日历" },
  { label: "待处理项", query: "有哪些事项逾期或待确认" },
  { label: "项目列表", query: "现在有哪些项目" },
];

export function CopilotPanel() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "copilot",
      content:
        "👋 我是 ShadowPM Command Center。\n\n我先负责查询、定位和总结，不直接替你改项目数据：\n" +
        "• 查预算：Aster X9 国内上市整合传播预算还有多少\n" +
        "• 查日历：接下来有哪些执行日历\n" +
        "• 查关注项：哪些事项逾期或待确认\n\n" +
        "进度和状态建议直接在管控表里改，会更快、更清楚。",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    function openFromKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", openFromKeyboard);
    return () => window.removeEventListener("keydown", openFromKeyboard);
  }, []);

  async function handleSend(query?: string) {
    const text = (query ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const result: CopilotResponse = await processCopilotMessage(text);
      setMessages((prev) => [
        ...prev,
        { role: "copilot", content: result.message, actions: result.actions },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "copilot", content: "❌ 处理请求时出了点问题，请重试。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-10 items-center gap-2 rounded-full bg-gray-950 px-3 text-xs font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6 sm:h-11 sm:px-4"
        title="Command Center"
      >
        <Command className="size-4" />
        Command
        <span className="hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/70 sm:inline">⌘K</span>
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-16 z-50 flex max-h-[78vh] flex-col overflow-hidden rounded-lg border bg-card shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-6 sm:max-h-[680px] sm:w-[460px]">
          <div className="flex items-center justify-between border-b bg-gray-950 px-4 py-3 text-gray-50">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-gray-50/20">
                <Command className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">ShadowPM Command Center</p>
                <p className="text-[10px] text-gray-400">查询、定位、总结项目数据</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800 size-7" onClick={() => setOpen(false)}>
              <X className="size-3.5" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {messages.map((msg, i) => (
              <div key={i} className="flex gap-2.5">
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${msg.role === "copilot" ? "bg-gray-900 text-white" : "bg-muted text-muted-foreground"}`}>
                  {msg.role === "copilot" ? <Bot className="size-3.5" /> : "我"}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === "copilot" ? "bg-muted/60 text-foreground" : "bg-primary text-primary-foreground"}`}>
                    {msg.content}
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.actions.map((action, j) => (
                        <Button key={j} size="sm" variant="outline" className="h-7 gap-1 text-xs"
                          onClick={() => { setOpen(false); router.push(action.href); }}>
                          {action.label} <ChevronRight className="size-3" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-10">
                <Loader2 className="size-3 animate-spin" />AI 思考中…
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {QUICK_COMMANDS.map((cmd, i) => (
                <Button key={i} size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleSend(cmd.query)}>
                  <Lightbulb className="size-3" />{cmd.label}
                </Button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border-t p-3">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="问项目、预算、日历、待处理项..."
              disabled={loading}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50" />
            <Button size="icon" className="size-8 shrink-0" disabled={loading || !input.trim()} onClick={() => handleSend()}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
