import { redirect } from "next/navigation";
import { getPersistedCurrentUser } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SiteRegistration } from "@/components/layout/SiteRegistration";
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
      <div className="flex min-w-0 flex-1 flex-col md:ml-56">
        <Header />
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
        <SiteRegistration className="pb-[4.5rem] md:pb-3" />
      </div>
      <CopilotPanel />
      <MobileBottomNav userRole={user.role} />
    </div>
  );
}
