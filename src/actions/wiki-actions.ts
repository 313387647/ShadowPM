"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject } from "@/lib/permissions";
import { PROJECT_DEFAULT_FOLDERS } from "@/lib/constants";
import type { $Enums } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/types";

// ── 读取（不抛异常，返回空数组代替） ──

export async function getProjectFolders(projectId: string) {
  await assertCanReadProject(projectId);
  return prisma.assetFolder.findMany({
    where: { projectId },
    include: { _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getFolderAssets(folderId: string) {
  const folder = await prisma.assetFolder.findUnique({
    where: { id: folderId },
    select: { projectId: true },
  });
  if (!folder) return [];
  await assertCanReadProject(folder.projectId);

  return prisma.assetItem.findMany({
    where: { folderId },
    orderBy: { title: "asc" },
  });
}

// ── 创建目录 ──

export async function createFolder(formData: FormData): Promise<ActionResult> {
  const projectId = formData.get("projectId") as string;
  await assertCanWriteProject(projectId);
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;

  if (!projectId || !name?.trim()) {
    return { success: false, message: "项目 ID 和目录名称为必填项" };
  }

  await prisma.assetFolder.create({
    data: { projectId, name: name.trim(), parentId },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: `目录「${name.trim()}」已创建` };
}

// ── 保存资产 ──

export async function saveAsset(formData: FormData): Promise<ActionResult> {
  const folderId = formData.get("folderId") as string;
  const title = formData.get("title") as string;
  const type = formData.get("type") as string;
  const content = (formData.get("content") as string) || null;

  if (!folderId || !title?.trim() || !type) {
    return { success: false, message: "目录、标题和类型为必填项" };
  }

  const folder = await prisma.assetFolder.findUnique({
    where: { id: folderId },
    select: { projectId: true },
  });
  if (!folder) return { success: false, message: "目录不存在" };
  await assertCanWriteProject(folder.projectId);

  // LINK 类型：content 存 URL；DOCUMENT 类型：content 存富文本
  await prisma.assetItem.create({
    data: {
      folderId,
      title: title.trim(),
      type: type as $Enums.AssetType,
      content: content?.trim() || null,
    },
  });

  revalidatePath(`/projects/${folder.projectId}`);
  return { success: true, message: `资产「${title.trim()}」已保存` };
}

// ── 项目初始化：自动生成 4 个默认文件夹 ──

export async function initProjectFolders(projectId: string) {
  await Promise.all(
    PROJECT_DEFAULT_FOLDERS.map((name) =>
      prisma.assetFolder.create({
        data: { projectId, name },
      })
    )
  );
}
