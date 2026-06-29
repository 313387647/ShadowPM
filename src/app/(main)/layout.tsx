import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} userName={user.name} />
      <div className="ml-56 flex flex-1 flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
      <CopilotPanel />
    </div>
  );
}
