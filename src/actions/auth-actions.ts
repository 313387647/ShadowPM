"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionCookieValue } from "@/lib/auth";

export async function login(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("测试账号不存在，请重置演示数据后重试");

  const cookieStore = await cookies();
  cookieStore.set("shadowpm-session", createSessionCookieValue({
    id: user.id,
    name: user.name,
    role: user.role,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  // LEADER 默认进大盘，MEMBER 进工作台
  redirect(user.role === "LEADER" ? "/dashboard" : "/workspace");
}

export async function loginWithForm(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string") throw new Error("缺少登录用户");
  await login(userId);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("shadowpm-session");
  redirect("/login");
}
