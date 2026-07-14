import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceCockpit } from "@/actions/workspace-actions";
import { WorkspaceCockpit } from "@/components/workspace/WorkspaceCockpit";

export default async function WorkspacePage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceCockpit()]);
  if (!user) return null;

  return <WorkspaceCockpit userName={user.name} data={data} />;
}
