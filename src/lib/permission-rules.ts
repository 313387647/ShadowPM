export type ProjectAccessRole = "LEADER" | "MEMBER" | string;

export function canReadProject(params: {
  userId: string;
  role: ProjectAccessRole;
  ownerId: string | null | undefined;
  memberRole?: "EDITOR" | "VIEWER" | string | null;
  isExternalProject?: boolean;
}) {
  if (params.isExternalProject) {
    return params.userId === params.ownerId || Boolean(params.memberRole);
  }
  return params.role === "LEADER" || params.userId === params.ownerId || Boolean(params.memberRole);
}

export function canWriteProject(params: {
  userId: string;
  role: ProjectAccessRole;
  ownerId: string | null | undefined;
  memberRole?: "EDITOR" | "VIEWER" | string | null;
}) {
  return params.userId === params.ownerId || params.memberRole === "EDITOR";
}

export function canManageProjectMembers(params: {
  userId: string;
  ownerId: string | null | undefined;
}) {
  return params.userId === params.ownerId;
}
