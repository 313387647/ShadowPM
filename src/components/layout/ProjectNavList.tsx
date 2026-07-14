"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleProjectFocus, type SidebarProject } from "@/actions/sidebar-actions";
import { cn } from "@/lib/utils";

const LIFECYCLE_STYLE = {
  UPCOMING: { label: "待启动", marker: "待", iconClass: "border-warning/30 bg-warning/10 text-warning" },
  ACTIVE: { label: "进行中", marker: "进", iconClass: "border-primary/30 bg-primary/10 text-primary" },
  COMPLETED: { label: "已完成", marker: "完", iconClass: "border-success/30 bg-success/10 text-success" },
} as const;

const PROJECT_SECTIONS = [
  { relationship: "OWNED", label: "我的项目" },
  { relationship: "MEMBER", label: "参与项目" },
] as const;

export function ProjectNavList({ projects, onNavigate }: { projects: SidebarProject[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function toggleFocus(project: SidebarProject) {
    const result = await toggleProjectFocus(project.id);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(result.isFocused ? `已重点关注「${project.name}」` : `已取消关注「${project.name}」`);
    router.refresh();
  }

  const sections = PROJECT_SECTIONS.map((section) => ({
    ...section,
    projects: projects.filter((project) => project.relationship === section.relationship && !project.archivedAt),
  })).filter((section) => section.projects.length > 0);
  const archivedProjects = projects.filter((project) => Boolean(project.archivedAt));

  if (sections.length === 0 && archivedProjects.length === 0) {
    return <p className="px-3 py-2 text-xs leading-5 text-muted-foreground">在工作台创建项目后，会显示在这里。</p>;
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <ProjectSection key={section.relationship} label={section.label} projects={section.projects} pathname={pathname} onNavigate={onNavigate} onToggleFocus={toggleFocus} />
      ))}
      {archivedProjects.length > 0 && <ProjectSection label="已归档" projects={archivedProjects} pathname={pathname} onNavigate={onNavigate} onToggleFocus={toggleFocus} archived />}
    </div>
  );
}

function ProjectSection({ label, projects, pathname, onNavigate, onToggleFocus, archived = false }: { label: string; projects: SidebarProject[]; pathname: string; onNavigate?: () => void; onToggleFocus: (project: SidebarProject) => void; archived?: boolean }) {
  const orderedProjects = [...projects].sort((left, right) => Number(right.isFocused) - Number(left.isFocused) || left.name.localeCompare(right.name, "zh-CN"));

  return (
    <section className={archived ? "border-t border-border/70 pt-4" : undefined}>
      <div className="mb-2 flex items-center justify-between px-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{label}</p>
        <span className="text-[10px] tabular-nums text-muted-foreground">{projects.length}</span>
      </div>
      <ProjectGroup projects={orderedProjects} pathname={pathname} onNavigate={onNavigate} onToggleFocus={onToggleFocus} />
    </section>
  );
}

function ProjectGroup({ projects, pathname, onNavigate, onToggleFocus }: { projects: SidebarProject[]; pathname: string; onNavigate?: () => void; onToggleFocus: (project: SidebarProject) => void }) {
  return (
    <div className="space-y-0.5">
      {projects.map((project) => {
        const isActive = pathname.startsWith(`/projects/${project.id}`);
        const lifecycle = LIFECYCLE_STYLE[project.lifecycle];
        return (
          <div key={project.id} className={cn("group flex items-center gap-1 rounded-lg border px-1 py-0.5 transition-colors", isActive ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border hover:bg-surface-2/75")}>
            <Link href={`/projects/${project.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm">
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
