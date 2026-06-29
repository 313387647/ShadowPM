// 角色权限常量
export const ROLES = {
  LEADER: "LEADER",
  MEMBER: "MEMBER",
} as const

// 任务状态映射
export const TASK_STATUS_MAP = {
  PENDING: "待启动",
  IN_PROGRESS: "进行中",
  COMPLETED: "已完成",
} as const

// 资金流水类型映射
export const FLOW_TYPE_MAP = {
  ALLOCATE: "预算分配",
  EXPENSE: "费用支出",
  REFUND: "费用退回",
} as const

// 资产类型映射
export const ASSET_TYPE_MAP = {
  DOCUMENT: "富文本",
  LINK: "外部链接",
  FILE: "附件",
} as const

// 项目知识库默认目录
export const PROJECT_DEFAULT_FOLDERS = [
  "01 策略与Brief",
  "02 文案与物料",
  "03 大文件索引",
  "04 复盘总结",
] as const

// 侧边栏导航菜单
export const NAV_ITEMS = [
  { label: "AI 工作台", href: "/workspace", roles: [ROLES.LEADER, ROLES.MEMBER] },
  { label: "全局大盘", href: "/dashboard", roles: [ROLES.LEADER] },
  { label: "团队负载", href: "/team", roles: [ROLES.LEADER] },
] as const
