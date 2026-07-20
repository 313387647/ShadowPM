"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleProjectFocus, type SidebarProject } from "@/actions/sidebar-actions";
import { cn } from "@/lib/utils";

const RECENT_PROJECTS_KEY = "shadowpm:recent-projects";
const RECENT_PROJECTS_LIMIT = 5;
const FOCUSED_PROJECTS_LIMIT = 3;

const LIFECYCLE_STYLE = {
  UPCOMING: { label: "待启动", marker: "待", iconClass: "border-warning/30 bg-warning/10 text-warning" },
  ACTIVE: { label: "进行中", marker: "进", iconClass: "border-primary/30 bg-primary/10 text-primary" },
  COMPLETED: { label: "已完成", marker: "完", iconClass: "border-success/30 bg-success/10 text-success" },
} as const;

export function ProjectNavList({ projects, onNavigate }: { projects: SidebarProject[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([]);
  const [focusOverrides, setFocusOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!stored) return;
    try {
      const recentIds = JSON.parse(stored);
      if (Array.isArray(recentIds)) setRecentProjectIds(recentIds.filter((id): id is string => typeof id === "string"));
    } catch {
      window.localStorage.removeItem(RECENT_PROJECTS_KEY);
    }
  }, []);

  useEffect(() => {
    const currentProjectId = projects.find((project) => pathname.startsWith(`/projects/${project.id}`))?.id;
    if (currentProjectId) rememberProject(currentProjectId, setRecentProjectIds);
  }, [pathname, projects]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt).map((project) => ({ ...project, isFocused: focusOverrides[project.id] ?? project.isFocused })),
    [focusOverrides, projects]
  );
  const focusedProjects = visibleProjects.filter((project) => project.isFocused).sort(byUpdatedAt).slice(0, FOCUSED_PROJECTS_LIMIT);
  const focusedIds = new Set(focusedProjects.map((project) => project.id));
  const projectById = new Map(visibleProjects.map((project) => [project.id, project]));
  const recentProjects = recentProjectIds
    .map((id) => projectById.get(id))
    .filter((project): project is SidebarProject => project !== undefined)
    .filter((project) => !focusedIds.has(project.id))
    .slice(0, RECENT_PROJECTS_LIMIT);

  async function toggleFocus(project: SidebarProject) {
    const result = await toggleProjectFocus(project.id);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    setFocusOverrides((current) => ({ ...current, [project.id]: result.isFocused === true }));
    router.refresh();
  }

  if (visibleProjects.length === 0) {
    return <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">在工作台创建项目后，会显示在这里。</p>;
  }

  return (
    <div className="space-y-5">
      <ProjectSection label="重点项目" projects={focusedProjects} pathname={pathname} onNavigate={onNavigate} onToggleFocus={toggleFocus} onVisit={(id) => rememberProject(id, setRecentProjectIds)} emptyText="点击星标，将项目固定在这里。" />
      <ProjectSection label="最近访问" projects={recentProjects} pathname={pathname} onNavigate={onNavigate} onToggleFocus={toggleFocus} onVisit={(id) => rememberProject(id, setRecentProjectIds)} emptyText="打开过的项目会显示在这里。" />
      <Link href="/projects" onClick={onNavigate} className="flex items-center justify-center rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">查看全部项目</Link>
    </div>
  );
}

function ProjectSection({ label, projects, pathname, onNavigate, onToggleFocus, onVisit, emptyText }: { label: string; projects: SidebarProject[]; pathname: string; onNavigate?: () => void; onToggleFocus: (project: SidebarProject) => void; onVisit: (projectId: string) => void; emptyText: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-3">
        <p className="text-[11px] font-medium text-muted-foreground/80">{label}</p>
        <span className="text-[11px] tabular-nums text-muted-foreground">{projects.length}</span>
      </div>
      {projects.length > 0 ? <ProjectGroup projects={projects} pathname={pathname} onNavigate={onNavigate} onToggleFocus={onToggleFocus} onVisit={onVisit} /> : <p className="px-3 py-1 text-xs leading-5 text-muted-foreground">{emptyText}</p>}
    </section>
  );
}

function ProjectGroup({ projects, pathname, onNavigate, onToggleFocus, onVisit }: { projects: SidebarProject[]; pathname: string; onNavigate?: () => void; onToggleFocus: (project: SidebarProject) => void; onVisit: (projectId: string) => void }) {
  return (
    <div className="space-y-0.5">
      {projects.map((project) => {
        const isActive = pathname.startsWith(`/projects/${project.id}`);
        const lifecycle = LIFECYCLE_STYLE[project.lifecycle];
        return (
          <div key={project.id} className={cn("group flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors", isActive ? "bg-surface-2" : "hover:bg-surface-2/75")}>
            <Link href={`/projects/${project.id}`} onClick={() => { onVisit(project.id); onNavigate?.(); }} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm">
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none", lifecycle.iconClass)} title={lifecycle.label} aria-label={lifecycle.label}>{lifecycle.marker}</span>
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
            </Link>
            <button type="button" onClick={() => onToggleFocus(project)} className={cn("flex size-7 shrink-0 items-center justify-center rounded-md transition-colors", project.isFocused ? "text-warning hover:bg-warning/10" : "text-muted-foreground/55 hover:bg-surface-1 hover:text-warning")} aria-label={project.isFocused ? `取消关注 ${project.name}` : `重点关注 ${project.name}`} title={project.isFocused ? "取消重点关注" : "重点关注"}>
              <Star className={cn("size-3.5", project.isFocused && "fill-current")} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function byUpdatedAt(left: SidebarProject, right: SidebarProject) {
  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function rememberProject(projectId: string, setRecentProjectIds: React.Dispatch<React.SetStateAction<string[]>>) {
  setRecentProjectIds((current) => {
    const next = [projectId, ...current.filter((id) => id !== projectId)].slice(0, RECENT_PROJECTS_LIMIT);
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
    return next;
  });
}
