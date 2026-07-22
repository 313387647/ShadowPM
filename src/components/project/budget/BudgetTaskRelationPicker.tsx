"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

type TaskOption = { id: string; name: string };

export function BudgetTaskRelationPicker({ tasks, initialTaskIds }: { tasks: TaskOption[]; initialTaskIds: string[] }) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialTaskIds);
  const initialKey = initialTaskIds.join(",");

  useEffect(() => {
    setSelectedIds(initialKey ? initialKey.split(",") : []);
    setQuery("");
  }, [initialKey]);

  const selectedTasks = useMemo(() => tasks.filter((task) => selectedIds.includes(task.id)), [selectedIds, tasks]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return tasks.filter((task) => !selectedIds.includes(task.id) && task.name.toLocaleLowerCase().includes(normalized)).slice(0, 6);
  }, [query, selectedIds, tasks]);

  function addTask(taskId: string) {
    setSelectedIds((ids) => ids.includes(taskId) ? ids : [...ids, taskId]);
    setQuery("");
  }

  function removeTask(taskId: string) {
    setSelectedIds((ids) => ids.filter((id) => id !== taskId));
  }

  return <fieldset>
    <legend className="text-xs text-muted-foreground">关联管控事项（可不选）</legend>
    {selectedIds.map((taskId) => <input key={taskId} type="hidden" name="taskIds" value={taskId} />)}
    <div className="mt-2 rounded-[8px] border border-input bg-canvas/30 p-2">
      {selectedTasks.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{selectedTasks.map((task) => <span key={task.id} className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md bg-surface-3 py-1 pl-2 pr-1 text-xs text-secondary-foreground"><span className="truncate">{task.name}</span><button type="button" onClick={() => removeTask(task.id)} className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground" aria-label={`移除关联事项：${task.name}`}><X className="size-3" /></button></span>)}</div>}
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setQuery(""); } }} placeholder={selectedTasks.length ? "继续搜索事项" : "搜索并关联事项"} className="h-8 border-0 bg-transparent pl-8 text-xs shadow-none hover:border-0 focus-visible:ring-0" /></div>
    </div>
    {query.trim() && <div role="listbox" aria-label="匹配的管控事项" className="mt-1 divide-y divide-border rounded-[8px] border border-border bg-surface-1">{matches.length ? matches.map((task) => <button key={task.id} type="button" role="option" aria-selected="false" onClick={() => addTask(task.id)} className="flex min-h-9 w-full items-center px-3 text-left text-sm hover:bg-surface-2">{task.name}</button>) : <p className="px-3 py-2 text-xs text-muted-foreground">没有匹配事项，预算项可以暂不关联。</p>}</div>}
    {!query.trim() && selectedTasks.length === 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">不关联事项也可以保存预算规划。</p>}
  </fieldset>;
}
