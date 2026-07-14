"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">项目看板</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">先看需关注项目，再按运行阶段进入具体项目管控表。</p>
        </div>
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或负责人" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">项目 / 负责人</th>
              <th className="px-3 py-2.5 font-medium">阶段</th>
              <th className="px-3 py-2.5 font-medium">完成度</th>
              <th className="px-3 py-2.5 font-medium">事项分布</th>
              <th className="px-3 py-2.5 font-medium">管理信号</th>
              <th className="px-3 py-2.5 font-medium">预算</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((project) => (
              <tr key={project.id} className="group transition-colors hover:bg-muted/35">
                <td className="max-w-[300px] px-4 py-3"><p className="truncate font-medium">{project.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{project.ownerName}</p></td>
                <td className="px-3 py-3"><LifecycleBadge lifecycle={project.lifecycle} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${project.taskProgress}%` }} /></div><span className="w-9 text-xs tabular-nums">{project.taskProgress}%</span></div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">进行 {project.inProgressCount} · 待启 {project.pendingCount} · 完成 {project.completedTasks}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{project.overdueCount > 0 && <Badge variant="destructive">逾期 {project.overdueCount}</Badge>}{project.balance < 0 && <Badge variant="destructive">超支</Badge>}{project.budgetUsage >= 90 && project.balance >= 0 && <Badge variant="outline">预算高消耗</Badge>}{!project.isAtRisk && <span className="text-xs text-emerald-700">状态正常</span>}</div></td>
                <td className="px-3 py-3"><p className={project.balance < 0 ? "font-mono text-xs text-destructive" : "font-mono text-xs"}>{formatWan(project.balance)} 结余</p><p className="mt-0.5 text-[11px] text-muted-foreground">确认 {formatWan(project.dynamicTotal)} · 使用 {project.budgetUsage}%</p></td>
                <td className="px-3 py-3"><Button asChild variant="ghost" size="icon" className="size-7 opacity-40 group-hover:opacity-100"><Link href={`/projects/${project.id}`} aria-label={`打开${project.name}`}><ArrowUpRight className="size-3.5" /></Link></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"><AlertTriangle className="size-4" />没有符合条件的项目</div>}
    </section>
  );
}

function LifecycleBadge({ lifecycle }: { lifecycle: PortfolioProject["lifecycle"] }) {
  const value = lifecycle === "ACTIVE" ? { label: "进行中", variant: "default" as const } : lifecycle === "UPCOMING" ? { label: "待启动", variant: "outline" as const } : { label: "已归档", variant: "secondary" as const };
  return <Badge variant={value.variant}>{value.label}</Badge>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "rounded px-2.5 py-1 text-xs font-medium bg-foreground text-background" : "rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"}>{children}</button>;
}

function formatWan(value: number) {
  const absolute = Math.abs(value);
  const label = absolute >= 10000 ? `¥${Math.round(absolute / 10000).toLocaleString("zh-CN")}万` : `¥${absolute.toLocaleString("zh-CN")}`;
  return value < 0 ? `-${label}` : label;
}
