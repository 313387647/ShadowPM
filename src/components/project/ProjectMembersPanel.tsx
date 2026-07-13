"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { addProjectMember, removeProjectMember } from "@/actions/member-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProjectMemberPanelData = {
  owner: { id: string; name: string; role: string };
  members: {
    id: string;
    userId: string;
    role: "EDITOR" | "VIEWER";
    user: { id: string; name: string; role: string };
  }[];
  candidateUsers: { id: string; name: string; role: string }[];
  canManage: boolean;
};

type Props = {
  projectId: string;
  data: ProjectMemberPanelData;
};

export function ProjectMembersPanel({ projectId, data }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  function submitAdd(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await addProjectMember(formData);
      setMessage(result.message ?? (result.success ? "协作者已更新" : "操作失败"));
      if (result.success) formRef.current?.reset();
    });
  }

  function submitRemove(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await removeProjectMember(formData);
      setMessage(result.message ?? (result.success ? "协作者已移除" : "操作失败"));
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-w-0 items-center gap-2 text-left">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground"><Users className="size-3.5" /></span>
          <span className="min-w-0"><span className="block text-sm font-medium">项目成员</span><span className="block text-[11px] text-muted-foreground">{data.owner.name} 负责人 · {data.members.length} 位协作者</span></span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <div className="flex items-center gap-2">
          {!data.canManage && <Badge variant="outline">只读授权</Badge>}
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : "管理成员"}</Button>
        </div>
      </div>

      {expanded && <div className="border-t bg-muted/10 px-4 py-3">
        <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          被指派负责人不等于编辑授权。只有项目负责人和可编辑协作者能修改管控表、预算和日历。
        </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <p className="font-medium">{data.owner.name}</p>
          <p className="mt-0.5 text-muted-foreground">项目负责人 · 默认可编辑</p>
        </div>
        {data.members.map((member) => (
          <div key={member.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
            <div>
              <p className="font-medium">{member.user.name}</p>
              <p className="mt-0.5 text-muted-foreground">
                {member.role === "EDITOR" ? "可编辑协作者" : "只读协作者"}
              </p>
            </div>
            {data.canManage && (
              <form action={submitRemove}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="membershipId" value={member.id} />
                <Button type="submit" size="icon" variant="ghost" className="size-6" disabled={isPending}>
                  <X className="size-3" />
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>

      {data.canManage && (
        <form ref={formRef} action={submitAdd} className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
          <input type="hidden" name="projectId" value={projectId} />
          <select name="userId" required className="h-8 min-w-40 rounded-md border bg-background px-2 text-xs outline-none">
            <option value="">选择成员</option>
            {data.candidateUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.role === "LEADER" ? "管理者" : "成员"}
              </option>
            ))}
          </select>
          <select name="role" defaultValue="EDITOR" className="h-8 rounded-md border bg-background px-2 text-xs outline-none">
            <option value="EDITOR">可编辑</option>
            <option value="VIEWER">只读</option>
          </select>
          <Button type="submit" size="sm" className="h-8 gap-1.5" disabled={isPending || data.candidateUsers.length === 0}>
            <UserPlus className="size-3.5" />
            添加协作者
          </Button>
          {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </form>
      )}
      </div>}
    </section>
  );
}
