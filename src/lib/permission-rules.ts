export type ProjectAccessRole = "LEADER" | "MEMBER" | string;

export function canReadProject(params: {
  userId: string;
  role: ProjectAccessRole;
  ownerId: string | null | undefined;
}) {
  return params.role === "LEADER" || params.userId === params.ownerId;
}

export function canWriteProject(params: {
  userId: string;
  role: ProjectAccessRole;
  ownerId: string | null | undefined;
}) {
  return params.userId === params.ownerId;
}
