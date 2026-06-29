import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("shadowpm-session");
  const { pathname } = request.nextUrl;

  // 放行登录页与静态资源
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 未登录 → 重定向到登录页
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 角色路由守卫：LEADER 专属页面
  const [, , role] = session.value.split(":");
  const leaderOnly = ["/dashboard", "/budget", "/team"];
  if (leaderOnly.some((p) => pathname.startsWith(p)) && role !== "LEADER") {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
