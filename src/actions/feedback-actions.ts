"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, requireCurrentUser } from "@/lib/permissions";

export type ProjectFeedbackDTO = {
  id: string;
  projectId: string;
  projectName: string;
  testerName: string;
  rating: number;
  aiAccuracy: string;
  uploadOutcome: string;
  wouldUse: string;
  budgetIssue: boolean;
  calendarIssue: boolean;
  ownerIssue: boolean;
  missingInfo: boolean;
  friction: string | null;
  notes: string | null;
  createdAt: Date;
};

const AI_ACCURACY = new Set(["GOOD", "PARTIAL", "POOR", "NOT_TESTED"]);
const UPLOAD_OUTCOME = new Set(["CREATED", "CREATED_WITH_EDITS", "FAILED", "BLOCKED"]);
const WOULD_USE = new Set(["YES", "MAYBE", "NO"]);

export async function submitProjectFeedback(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const user = await assertCanReadProject(projectId);

  const rating = Number(formData.get("rating") ?? 0);
  const aiAccuracy = String(formData.get("aiAccuracy") ?? "");
  const uploadOutcome = String(formData.get("uploadOutcome") ?? "");
  const wouldUse = String(formData.get("wouldUse") ?? "");
  const friction = cleanText(formData.get("friction"));
  const notes = cleanText(formData.get("notes"));

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false, message: "请选择 1-5 分评分" };
  }
  if (!AI_ACCURACY.has(aiAccuracy) || !UPLOAD_OUTCOME.has(uploadOutcome) || !WOULD_USE.has(wouldUse)) {
    return { success: false, message: "反馈选项不完整" };
  }

  await prisma.projectFeedback.create({
    data: {
      projectId,
      createdById: user.id,
      testerName: user.name,
      rating,
      aiAccuracy,
      uploadOutcome,
      wouldUse,
      budgetIssue: formData.get("budgetIssue") === "on",
      calendarIssue: formData.get("calendarIssue") === "on",
      ownerIssue: formData.get("ownerIssue") === "on",
      missingInfo: formData.get("missingInfo") === "on",
      friction,
      notes,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/feedback");
  return { success: true, message: "反馈已记录" };
}

export async function getProjectFeedback(projectId: string): Promise<ProjectFeedbackDTO[]> {
  await assertCanReadProject(projectId);
  const rows = await prisma.projectFeedback.findMany({
    where: { projectId },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return rows.map(toDTO);
}

export async function getAlphaFeedback(): Promise<ProjectFeedbackDTO[]> {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("只有管理者可以查看外测反馈");

  const rows = await prisma.projectFeedback.findMany({
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map(toDTO);
}

function cleanText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 2000) : null;
}

function toDTO(row: {
  id: string;
  projectId: string;
  testerName: string;
  rating: number;
  aiAccuracy: string;
  uploadOutcome: string;
  wouldUse: string;
  budgetIssue: boolean;
  calendarIssue: boolean;
  ownerIssue: boolean;
  missingInfo: boolean;
  friction: string | null;
  notes: string | null;
  createdAt: Date;
  project: { name: string };
}): ProjectFeedbackDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    testerName: row.testerName,
    rating: row.rating,
    aiAccuracy: row.aiAccuracy,
    uploadOutcome: row.uploadOutcome,
    wouldUse: row.wouldUse,
    budgetIssue: row.budgetIssue,
    calendarIssue: row.calendarIssue,
    ownerIssue: row.ownerIssue,
    missingInfo: row.missingInfo,
    friction: row.friction,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}
