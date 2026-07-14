import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("shadowpm-session");
  const { pathname } = request.nextUrl;

  // 放行登录页、公开只读分享和静态资源
  if (
    pathname === "/guide" ||
    pathname === "/login" ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 未登录 → 重定向到登录页
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
