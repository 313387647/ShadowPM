import { redirect } from "next/navigation";
import { getPersistedCurrentUser } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { getSidebarProjects } from "@/actions/sidebar-actions";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getPersistedCurrentUser();
  if (!user) redirect("/login");
  const projects = await getSidebarProjects();

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar userRole={user.role} userName={user.name} projects={projects} />
      <div className="flex min-w-0 flex-1 flex-col md:ml-60">
        <Header userRole={user.role} userName={user.name} projects={projects} />
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <CopilotPanel />
      <MobileBottomNav userRole={user.role} />
    </div>
  );
}
