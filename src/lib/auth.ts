import { cookies } from "next/headers";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  name: string;
  role: "LEADER" | "MEMBER";
}

export const SESSION_COOKIE = "shadowpm-session";

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

function getSessionSecret() {
  const secret = process.env.SHADOWPM_SESSION_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing SHADOWPM_SESSION_SECRET or AUTH_SECRET");
  }
  return "shadowpm-local-dev-secret";
}

function hashSessionToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("base64url");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.authSession.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } }),
  ]);

  return token;
}

export async function revokeSession(token: string) {
  await prisma.authSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;

  const record = await prisma.authSession.findFirst({
    where: {
      tokenHash: hashSessionToken(session.value),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { isActive: true },
    },
    select: { user: { select: { id: true, name: true, role: true } } },
  });

  return record?.user ?? null;
}
