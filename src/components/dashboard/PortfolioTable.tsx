"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export type PortfolioProject = {
  id: string;
  name: string;
  ownerName: string;
  plannedBudget: number;
  dynamicTotal: number;
  consumed: number;
  balance: number;
  budgetUsage: number;
  totalTasks: number;
  completedTasks: number;
  taskProgress: number;
  overdueCount: number;
  pendingCount: number;
  inProgressCount: number;
  isAtRisk: boolean;
  lifecycle: "UPCOMING" | "ACTIVE" | "COMPLETED";
  nextNode: { date: Date; content: string } | null;
  updatedAt: Date;
};

type Filter = "ALL" | "ATTENTION" | "ACTIVE" | "UPCOMING" | "COMPLETED";

export function PortfolioTable({ projects }: { projects: PortfolioProject[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects
      .filter((project) => !normalized || `${project.name} ${project.ownerName}`.toLowerCase().includes(normalized))
      .filter((project) => filter === "ALL" || (filter === "ATTENTION" ? project.isAtRisk : project.lifecycle === filter))
      .sort((a, b) => {
        const attentionA = a.overdueCount * 100 + (a.balance < 0 ? 1000 : 0) + a.budgetUsage;
        const attentionB = b.overdueCount * 100 + (b.balance < 0 ? 1000 : 0) + b.budgetUsage;
        return attentionB - attentionA || a.taskProgress - b.taskProgress;
      });
  }, [filter, projects, query]);

  return (
    <section className="table-shell overflow-hidden">
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-sm font-semibold">项目组合</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")}>全部 {projects.length}</FilterButton>
            <FilterButton active={filter === "ATTENTION"} onClick={() => setFilter("ATTENTION")}>需关注 {projects.filter((project) => project.isAtRisk).length}</FilterButton>
            <FilterButton active={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")}>进行中 {projects.filter((project) => project.lifecycle === "ACTIVE").length}</FilterButton>
            <FilterButton active={filter === "UPCOMING"} onClick={() => setFilter("UPCOMING")}>待启动 {projects.filter((project) => project.lifecycle === "UPCOMING").length}</FilterButton>
            <FilterButton active={filter === "COMPLETED"} onClick={() => setFilter("COMPLETED")}>已归档 {projects.filter((project) => project.lifecycle === "COMPLETED").length}</FilterButton>
          </div>
          <label className="flex h-8 min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 sm:w-52">
            <Search className="size-3.5 text-muted-foreground" />
            <Input aria-label="搜索项目或负责人" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或负责人" className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0" />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">项目 / 负责人</th>
              <th className="px-3 py-2.5 font-medium">下一节点</th>
              <th className="px-3 py-2.5 font-medium">逾期</th>
              <th className="px-3 py-2.5 font-medium">预算</th>
              <th className="px-3 py-2.5 font-medium">更新</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((project) => (
              <tr key={project.id} className="group transition-colors hover:bg-muted/35">
                <td className="max-w-[300px] px-4 py-3"><Link href={`/projects/${project.id}`} className="truncate font-medium hover:text-primary">{project.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{project.ownerName} · {lifecycleLabel(project.lifecycle)}</p></td>
                <td className="max-w-52 px-3 py-3"><p className="truncate text-xs">{project.nextNode?.content ?? "未安排"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{project.nextNode ? formatDate(project.nextNode.date) : ""}</p></td>
                <td className="px-3 py-3">{project.overdueCount > 0 ? <span className="text-xs font-medium text-destructive">{project.overdueCount} 项</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                <td className="px-3 py-3"><p className={project.balance < 0 ? "font-mono text-xs text-destructive" : "font-mono text-xs"}>{formatWan(project.balance)}</p><p className="mt-0.5 text-[11px] text-muted-foreground">已用 {project.budgetUsage}%</p></td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{formatRelative(project.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"><AlertTriangle className="size-4" />没有符合条件的项目</div>}
    </section>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "rounded px-2.5 py-1 text-xs font-medium bg-foreground text-background" : "rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"}>{children}</button>;
}

function formatWan(value: number) {
  const absolute = Math.abs(value);
  const label = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${absolute.toLocaleString("zh-CN")}`;
  return value < 0 ? `-${label}` : label;
}

function lifecycleLabel(value: PortfolioProject["lifecycle"]) {
  return value === "ACTIVE" ? "进行中" : value === "UPCOMING" ? "待启动" : "已归档";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatRelative(value: Date) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}
