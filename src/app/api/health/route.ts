import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "shadowpm",
      database: "connected",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("health check failed:", error);
    return NextResponse.json({
      status: "degraded",
      service: "shadowpm",
      database: "unavailable",
      timestamp: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
