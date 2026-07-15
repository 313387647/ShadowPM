import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

function getPublicOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto === "https" ? "https" : "http"}://${forwardedHost}`;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return configured || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const origin = getPublicOrigin(request);
  const formData = await request.formData();
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).trim().toLowerCase() : "";
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  if (!email || !password) {
    return NextResponse.redirect(new URL("/login?error=invalid-credentials", origin), 303);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, passwordHash: true, isActive: true },
  });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.redirect(new URL("/login?error=invalid-credentials", origin), 303);
  }

  const destination = user.role === "LEADER" ? "/dashboard" : "/workspace";
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.cookies.set(SESSION_COOKIE, await createSession(user.id), getSessionCookieOptions());
  return response;
}
