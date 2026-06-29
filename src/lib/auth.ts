import { cookies } from "next/headers";

export interface SessionUser {
  id: string;
  name: string;
  role: "LEADER" | "MEMBER";
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("shadowpm-session");
  if (!session) return null;
  const [id, name, role] = session.value.split(":");
  return { id, name, role: role as "LEADER" | "MEMBER" };
}
