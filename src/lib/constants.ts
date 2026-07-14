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

// 预算业务动作映射：flowType 负责财务计算，operation 负责业务语义
export const BUDGET_OPERATION_MAP = {
  CONFIRM_POOL: "确认项目预算池",
  ADJUST_POOL: "调整项目预算池",
  CANCEL_POOL: "取消项目预算池",
  CONFIRM: "预算确定",
  SUPPLEMENT: "预算增补",
  REDUCE: "预算调减",
  ALLOCATE: "分配到事项",
  RETURN: "退回预算池",
  TRANSFER: "事项间划拨",
  SPLIT: "预算拆分",
  MERGE: "预算合并",
  EXPENSE: "实际支出",
  REFUND: "支出退款",
  REVERSAL: "冲正",
  ADJUST: "调整事项预算",
  SPLIT_OUT: "拆分转出",
  SPLIT_IN: "拆分转入",
  APPROVE: "报批通过",
  DISBURSE: "划拨给第三方",
  ACCEPT: "已验收",
  CANCEL: "取消事项预算",
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
  { label: "工作台", href: "/workspace", roles: [ROLES.LEADER, ROLES.MEMBER] },
  { label: "全局大盘", href: "/dashboard", roles: [ROLES.LEADER] },
  { label: "使用反馈", href: "/feedback", roles: [ROLES.LEADER] },
  { label: "团队权限", href: "/team", roles: [ROLES.LEADER] },
] as const
