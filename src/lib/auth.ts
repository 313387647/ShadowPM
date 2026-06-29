import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionUser {
  id: string;
  name: string;
  role: "LEADER" | "MEMBER";
}

const SESSION_COOKIE = "shadowpm-session";

function getSessionSecret() {
  const secret = process.env.SHADOWPM_SESSION_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing SHADOWPM_SESSION_SECRET or AUTH_SECRET");
  }
  return "shadowpm-local-dev-secret";
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function encodeSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeSession(value: string): SessionUser | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionUser>;
    if (!parsed.id || !parsed.name || (parsed.role !== "LEADER" && parsed.role !== "MEMBER")) return null;
    return { id: parsed.id, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

export function createSessionCookieValue(user: SessionUser) {
  return encodeSession(user);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;
  return decodeSession(session.value);
}
