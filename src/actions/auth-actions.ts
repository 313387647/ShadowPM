"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revokeSession, SESSION_COOKIE } from "@/lib/auth";

export async function logout() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (session) await revokeSession(session.value);
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
