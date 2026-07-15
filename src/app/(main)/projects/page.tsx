import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceCockpit } from "@/actions/workspace-actions";

export default async function ProjectsPage({ searchParams }: { searchParams?: { status?: string } }) {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceCockpit()]);
  if (!user) return null;

  const archived = searchParams?.status === "archived";
  const projects = data.myProjects.filter((project) => archived ? Boolean(project.archivedAt) : !project.archivedAt);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-7">
      <header className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">项目</h1><p className="mt-1 text-sm text-muted-foreground">查看我负责或参与的全部项目，已归档项目不会常驻在侧边栏。</p></div>
        <Link href="/projects/new" className="text-sm font-medium text-primary hover:text-primary/80">新建项目</Link>
      </header>
      <nav className="flex gap-4 border-b border-border text-sm" aria-label="项目筛选"><Link href="/projects" className={!archived ? "border-b-2 border-primary px-1 pb-2 font-medium text-foreground" : "px-1 pb-2 text-muted-foreground hover:text-foreground"}>进行中与待启动</Link><Link href="/projects?status=archived" className={archived ? "border-b-2 border-primary px-1 pb-2 font-medium text-foreground" : "px-1 pb-2 text-muted-foreground hover:text-foreground"}>已归档</Link></nav>
      <section className="table-shell">{projects.length === 0 ? <div className="px-4 py-12 text-center text-sm text-muted-foreground">{archived ? "暂无已归档项目。" : "暂无项目。"}</div> : <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border bg-muted/25 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">项目</th><th className="px-3 py-2.5 font-medium">阶段</th><th className="px-3 py-2.5 font-medium">需要我处理</th><th className="px-3 py-2.5 font-medium">下一节点</th><th className="px-3 py-2.5 font-medium">预算信号</th><th className="px-3 py-2.5 font-medium">最后更新</th></tr></thead><tbody className="divide-y divide-border">{projects.map((project) => <tr key={project.id} className="transition-colors hover:bg-primary/[0.04]"><td className="px-4 py-3"><Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">{project.name}</Link></td><td className="px-3 py-3 text-xs text-muted-foreground">{lifecycleLabel(project.lifecycle)}</td><td className="px-3 py-3 tabular-nums">{project.needsMyAttention}</td><td className="px-3 py-3 text-xs">{project.nextNode?.content ?? "待排期"}</td><td className="px-3 py-3 text-xs text-muted-foreground">{project.budgetSignal}</td><td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(project.updatedAt)}</td></tr>)}</tbody></table></div><div className="divide-y divide-border md:hidden">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="block px-4 py-4 transition-colors hover:bg-primary/[0.04]"><div className="flex items-start justify-between gap-3"><p className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</p><span className="shrink-0 text-xs text-muted-foreground">{lifecycleLabel(project.lifecycle)}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">下一步：{project.nextNode?.content ?? "待安排"}</p><div className="mt-2 flex items-center gap-3 text-xs"><span className={project.needsMyAttention > 0 ? "font-medium text-primary" : "text-muted-foreground"}>{project.needsMyAttention > 0 ? `${project.needsMyAttention} 项待处理` : "暂无待处理"}</span>{project.budgetSignal !== "预算正常" && <span className="truncate text-warning">{project.budgetSignal}</span>}<span className="ml-auto shrink-0 text-muted-foreground">{formatDate(project.updatedAt)}</span></div></Link>)}</div></>}</section>
    </div>
  );
}

function lifecycleLabel(lifecycle: "UPCOMING" | "ACTIVE" | "COMPLETED") { return lifecycle === "UPCOMING" ? "待启动" : lifecycle === "COMPLETED" ? "已完成" : "进行中"; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(value); }
