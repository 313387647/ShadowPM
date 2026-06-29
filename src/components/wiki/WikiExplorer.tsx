"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderPlus,
  FileText,
  Link,
  Folder,
  Loader2,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFolder, saveAsset, getFolderAssets } from "@/actions/wiki-actions";

type Folder = {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  _count: { assets: number };
};
type Asset = {
  id: string;
  folderId: string;
  title: string;
  type: string;
  content: string | null;
  version: number;
};

interface Props { projectId: string; folders: Folder[] }

export function WikiExplorer({ projectId, folders }: Props) {
  const router = useRouter();
  const folderFormRef = useRef<HTMLFormElement>(null);
  const assetFormRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<Folder | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assetType, setAssetType] = useState<"LINK" | "DOCUMENT">("LINK");

  // 目录树（flat，仅一级；默认文件夹无 parentId）
  const rootFolders = folders.filter((f) => !f.parentId);

  async function selectFolder(folder: Folder) {
    setSelected(folder);
    setLoadingAssets(true);
    try {
      setAssets(await getFolderAssets(folder.id));
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }

  // ── 初始自动选中第一个目录 ──
  useEffect(() => {
    if (rootFolders.length > 0 && !selected) {
      selectFolder(rootFolders[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);

  async function onFolderSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      formData.set("projectId", projectId);
      const result = await createFolder(formData);
      if (result.success) {
        toast.success(result.message!);
        folderFormRef.current?.reset();
        setShowNewFolder(false);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAssetSubmit(formData: FormData) {
    if (!selected) return;
    setSubmitting(true);
    try {
      formData.set("folderId", selected.id);
      formData.set("type", assetType);
      const result = await saveAsset(formData);
      if (result.success) {
        toast.success(result.message!);
        assetFormRef.current?.reset();
        setShowNewAsset(false);
        await selectFolder(selected);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      {/* ── 左侧目录侧边栏 ── */}
      <div className="rounded-lg border self-start">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">📁 知识库</p>
          <Button
            size="sm"
            variant="ghost"
            className="size-7 p-0"
            onClick={() => setShowNewFolder(true)}
            title="新建文件夹"
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </div>

        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Folder className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">暂无目录</p>
          </div>
        ) : (
          <div className="p-1.5">
            {rootFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => selectFolder(folder)}
                className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  selected?.id === folder.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/50 text-foreground/80"
                }`}
              >
                <Folder
                  className={`size-3.5 shrink-0 ${
                    selected?.id === folder.id
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="truncate flex-1">{folder.name}</span>
                {folder._count.assets > 0 && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {folder._count.assets}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 右侧资产区 ── */}
      <div className="min-h-[400px]">
        {!selected ? (
          <div className="flex flex-col items-center justify-center rounded-lg border py-20 text-center">
            <FileText className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              选择左侧目录查看资产
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              支持外部链接和富文本文档
            </p>
          </div>
        ) : (
          <>
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">{selected.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selected._count.assets} 个资产
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShowNewAsset(true)}
              >
                <Plus className="size-3" />
                新增资产
              </Button>
            </div>

            {/* 资产卡片网格 */}
            {loadingAssets ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
                <p className="text-sm text-muted-foreground">此目录暂无资产</p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  点击「新增资产」添加链接或文档
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {assets.map((asset) => {
                  const isLink = asset.type === "LINK";
                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        if (isLink && asset.content) {
                          window.open(asset.content, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className={`group rounded-xl border bg-card p-4 shadow-sm transition-all ${
                        isLink
                          ? "cursor-pointer hover:border-primary/40 hover:shadow-md"
                          : ""
                      }`}
                    >
                      {/* 顶行：图标 + 标题 */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            isLink
                              ? "bg-blue-50 text-blue-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {isLink ? (
                            <Link className="size-4" />
                          ) : (
                            <Pencil className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {asset.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {isLink ? "🔗 外部链接" : "📝 富文本"}
                            <span className="ml-2">v{asset.version}</span>
                          </p>
                        </div>
                        {isLink && (
                          <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>

                      {/* 预览 */}
                      {!isLink && asset.content && (
                        <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-2 whitespace-pre-wrap">
                          {asset.content.slice(0, 120)}
                          {asset.content.length > 120 && "…"}
                        </p>
                      )}
                      {isLink && (
                        <p className="mt-2 text-xs text-primary truncate">
                          {asset.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 新建目录 Dialog ── */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <form ref={folderFormRef} action={onFolderSubmit} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <div>
              <label className="block text-sm font-medium mb-1.5">
                文件夹名称 <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                required
                autoFocus
                placeholder="例如：竞品资料收集"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowNewFolder(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                创建
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 新增资产 Dialog ── */}
      <Dialog open={showNewAsset} onOpenChange={setShowNewAsset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增资产</DialogTitle>
          </DialogHeader>
          <form ref={assetFormRef} action={onAssetSubmit} className="space-y-4">
            {/* 标题 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                标题 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                autoFocus
                placeholder="例如：KOL 合作排期表链接"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 类型下拉 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                类型 <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as "LINK" | "DOCUMENT")}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
              >
                <option value="LINK">🔗 外部链接</option>
                <option value="DOCUMENT">📝 富文本</option>
              </select>
            </div>

            {/* 条件输入 */}
            {assetType === "LINK" ? (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  URL 地址 <span className="text-red-500">*</span>
                </label>
                <input
                  name="content"
                  required
                  type="url"
                  placeholder="https://pan.baidu.com/s/xxx 或 https://docs.qq.com/xxx"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  支持粘贴迪盘、百度网盘、腾讯文档等任意链接
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="content"
                  required
                  rows={5}
                  placeholder="输入富文本内容…"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNewAsset(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
