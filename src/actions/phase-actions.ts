"use server";

import { prisma } from "@/lib/prisma";
import { assertCanReadProject } from "@/lib/permissions";

/** Modules are lightweight labels on control items; this is read-only support for the table and filters. */
export async function getProjectPhases(projectId: string) {
  await assertCanReadProject(projectId);
  return prisma.phase.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });
}
