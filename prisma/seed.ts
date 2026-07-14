/**
 * ShadowPM demo data reset.
 *
 * The dataset intentionally simulates operational variance: different project owners,
 * collaboration permissions, lifecycle states, budget pressure, and calendar cadence.
 * Every seeded control item, calendar entry, and budget pool is complete enough to operate.
 * Run with: npx prisma db seed
 */

import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient, TaskStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type ControlItem = {
  workstream: string;
  name: string;
  description: string;
  notes: string;
  assignee: string | null;
  department: string;
  deadline: string | null;
  priority: "P0" | "P1" | "P2" | "P3";
  status: TaskStatus;
  needsConfirmation?: boolean;
  missingFields?: string[];
};

type CalendarItem = {
  task: string;
  date: string | null;
  startTime?: string;
  channel: string | null;
  content: string;
  owner: string | null;
  department: string;
  status: "PLANNED" | "CONFIRMED" | "DONE" | "CANCELED";
  notes?: string;
};

type BudgetItem = {
  task: string;
  operation: "CONFIRM" | "SUPPLEMENT" | "EXPENSE" | "REFUND" | "TRANSFER";
  flowType: "ALLOCATE" | "EXPENSE" | "REFUND";
  amount: number;
  description: string;
  createdBy: string;
};

type DemoUserName = "陈鹏" | "周予安" | "许闻澜" | "方明澈" | "罗嘉言";

type ProjectScenario = {
  name: string;
  owner: DemoUserName;
  objective: string;
  budget: number;
  startDate: string;
  endDate: string;
  collaborators?: { name: DemoUserName; role: "EDITOR" | "VIEWER" }[];
  items: ControlItem[];
  calendar: CalendarItem[];
  budgetFlows: BudgetItem[];
};

type SeedProjectLifecycle = "ACTIVE" | "COMPLETED" | "UPCOMING";

const LIFECYCLE_BY_PROJECT: Record<string, SeedProjectLifecycle> = {
  "品牌危机响应演练": "COMPLETED",
  "年度可持续发展报告传播": "COMPLETED",
  "客户试驾体验运营升级": "COMPLETED",
  "开发者生态伙伴峰会": "UPCOMING",
  "年度产品培训直播季": "UPCOMING",
  "上海用户社群周年活动": "UPCOMING",
  "行业媒体趋势论坛": "UPCOMING",
};

type GeneratedScenarioInput = {
  name: string;
  owner: DemoUserName;
  objective: string;
  budget: number;
  startDate: string;
  endDate: string;
  collaborators: { name: DemoUserName; role: "EDITOR" | "VIEWER" }[];
  strategyItem: string;
  executionWorkstream: string;
  executionItem: string;
  executionDepartment: string;
  executionDate: string;
  partnerWorkstream: string;
  partnerItem: string;
  partnerOwner: string;
  partnerDepartment: string;
  partnerDate: string | null;
  measurementItem: string;
  measurementOwner: string | null;
  measurementDepartment: string;
  budgetState: "NORMAL" | "HIGH_USAGE";
};

function buildGeneratedScenario(input: GeneratedScenarioInput): ProjectScenario {
  const budgetTask = "__PROJECT_POOL__";
  const budgetFlows: BudgetItem[] = [
    { task: budgetTask, operation: "CONFIRM", flowType: "ALLOCATE", amount: input.budget, description: `${input.name}预算确定`, createdBy: input.owner },
    { task: input.executionItem, operation: "EXPENSE", flowType: "EXPENSE", amount: -Math.round(input.budget * (input.budgetState === "HIGH_USAGE" ? 0.58 : 0.24)), description: `${input.executionItem}执行费用`, createdBy: input.owner },
    { task: input.partnerItem, operation: "EXPENSE", flowType: "EXPENSE", amount: -Math.round(input.budget * (input.budgetState === "HIGH_USAGE" ? 0.36 : 0.16)), description: `${input.partnerItem}合作费用`, createdBy: input.owner },
  ];

  return {
    name: input.name,
    owner: input.owner,
    objective: input.objective,
    budget: input.budget,
    startDate: input.startDate,
    endDate: input.endDate,
    collaborators: input.collaborators,
    items: [
      { workstream: "项目统筹", name: input.strategyItem, description: `围绕“${input.objective}”确认目标、范围、节奏和关键依赖。`, notes: "核心目标已对齐，等待相关部门确认执行边界。", assignee: input.owner, department: "项目运营", deadline: input.startDate, priority: "P0", status: "IN_PROGRESS" },
      { workstream: input.executionWorkstream, name: input.executionItem, description: "形成可执行交付方案，明确交付标准、节点和验收人。", notes: "执行方案已完成初版，正在确认资源与排期。", assignee: input.owner, department: input.executionDepartment, deadline: input.executionDate, priority: "P0", status: "IN_PROGRESS" },
      { workstream: input.partnerWorkstream, name: input.partnerItem, description: "与外部合作方明确交付物、接口人、合同边界与验收方式。", notes: "第三方已收到 Brief，需在下一轮沟通确认交付承诺。", assignee: input.partnerOwner, department: input.partnerDepartment, deadline: input.partnerDate, priority: "P1", status: "PENDING" },
      { workstream: "数据与复盘", name: input.measurementItem, description: "建立过程数据、结果数据和复盘动作的统一记录方式。", notes: "指标口径已对齐，按既定节奏接入正式数据并完成复盘。", assignee: input.measurementOwner ?? input.owner, department: input.measurementDepartment, deadline: input.partnerDate ?? input.executionDate, priority: "P1", status: "PENDING" },
    ],
    calendar: [
      { task: input.executionItem, date: input.executionDate, startTime: "10:00", channel: "项目执行现场 / 线上协同", content: input.executionItem, owner: input.owner, department: input.executionDepartment, status: "PLANNED" },
      { task: input.partnerItem, date: input.partnerDate ?? input.executionDate, startTime: "14:00", channel: "合作方现场 / 线上会议", content: input.partnerItem, owner: input.partnerOwner, department: input.partnerDepartment, status: "PLANNED" },
    ],
    budgetFlows,
  };
}

const scenarios: ProjectScenario[] = [
  {
    name: "2026经营策略共识会",
    owner: "陈鹏",
    objective: "在下半年经营周期启动前统一战略优先级、资源投入和跨部门承诺。",
    budget: 420000,
    startDate: "2026-07-06",
    endDate: "2026-07-24",
    collaborators: [{ name: "周予安", role: "EDITOR" }, { name: "许闻澜", role: "VIEWER" }],
    items: [
      { workstream: "议题统筹", name: "确认经营会决策议题", description: "输出战略、预算、人力、重点项目四类决策清单。", notes: "CEO 已确认战略与预算两类议题，待补充人力议题负责人。", assignee: "陈鹏", department: "经营管理", deadline: "2026-07-12", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "会务执行", name: "锁定会场与远程接入方案", description: "满足 60 人线下和 20 人远程接入，含录制与同传。", notes: "主会场已预订，远程方案待 IT 压测。", assignee: "周予安", department: "综合管理", deadline: "2026-07-15", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "材料准备", name: "收集业务单元经营材料", description: "统一使用经营复盘模板，形成决策前读材料。", notes: "华东和海外单元按统一模板汇总，周报节点已锁定。", assignee: "方明澈", department: "经营管理", deadline: "2026-07-16", priority: "P0", status: "PENDING" },
      { workstream: "会后闭环", name: "发布决议与行动清单", description: "会后 24 小时内发送决议、责任人和截止日期。", notes: "待会议结束后执行。", assignee: "陈鹏", department: "经营管理", deadline: "2026-07-25", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "承载会务、制作和差旅预算的正式确认与流转。", notes: "预算已确认，按实际发生记账。", assignee: "陈鹏", department: "经营管理", deadline: "2026-07-10", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "锁定会场与远程接入方案", date: "2026-07-15", startTime: "14:00", channel: "总部会议中心", content: "会场与远程接入联调", owner: "周予安", department: "综合管理", status: "CONFIRMED" },
      { task: "确认经营会决策议题", date: "2026-07-21", startTime: "09:30", channel: "总部会议中心", content: "2026经营策略共识会", owner: "陈鹏", department: "经营管理", status: "CONFIRMED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 420000, description: "经营策略共识会预算确定", createdBy: "陈鹏" },
      { task: "锁定会场与远程接入方案", operation: "EXPENSE", flowType: "EXPENSE", amount: -86000, description: "会场与远程会议系统预付款", createdBy: "周予安" },
    ],
  },
  {
    name: "总部园区启用仪式",
    owner: "陈鹏",
    objective: "完成新园区启用仪式与员工导览，确保嘉宾、流程、安全和对外口径闭环。",
    budget: 860000,
    startDate: "2026-07-01",
    endDate: "2026-08-08",
    collaborators: [{ name: "周予安", role: "EDITOR" }],
    items: [
      { workstream: "现场执行", name: "完成园区动线与安全验收", description: "覆盖嘉宾动线、消防、雨天预案和医疗点位。", notes: "消防复检已通过，雨天备选动线待物业确认。", assignee: "周予安", department: "综合管理", deadline: "2026-07-18", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "嘉宾管理", name: "确认嘉宾名单与接待分工", description: "完成董事、客户、媒体三类嘉宾的 RSVP 与接待分组。", notes: "客户嘉宾 RSVP 仍缺 6 人。", assignee: "陈鹏", department: "品牌公关", deadline: "2026-07-20", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "内容传播", name: "发布园区启用新闻稿", description: "撰写并发布园区启用新闻稿与员工内宣稿。", notes: "新闻稿 V2 已进入法务审阅。", assignee: "许闻澜", department: "品牌公关", deadline: "2026-07-28", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "现场执行", name: "仪式彩排与总控表确认", description: "全流程彩排，确认主持词、视频、灯光与应急联络。", notes: "待活动前一天执行。", assignee: "周予安", department: "综合管理", deadline: "2026-08-06", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "启用仪式预算池。", notes: "已确认预算，执行成本接近上限。", assignee: "陈鹏", department: "经营管理", deadline: "2026-07-08", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "仪式彩排与总控表确认", date: "2026-08-06", startTime: "16:00", channel: "总部新园区", content: "园区启用仪式全流程彩排", owner: "周予安", department: "综合管理", status: "PLANNED" },
      { task: "发布园区启用新闻稿", date: "2026-08-08", startTime: "10:00", channel: "官网 / 企业公众号", content: "园区启用新闻稿发布", owner: "许闻澜", department: "品牌公关", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 860000, description: "总部园区启用仪式预算确定", createdBy: "陈鹏" },
      { task: "完成园区动线与安全验收", operation: "EXPENSE", flowType: "EXPENSE", amount: -410000, description: "现场搭建与安全服务合同", createdBy: "周予安" },
      { task: "发布园区启用新闻稿", operation: "EXPENSE", flowType: "EXPENSE", amount: -330000, description: "视频与传播物料制作", createdBy: "许闻澜" },
      { task: "确认嘉宾名单与接待分工", operation: "EXPENSE", flowType: "EXPENSE", amount: -80000, description: "嘉宾接待与交通预留", createdBy: "陈鹏" },
    ],
  },
  {
    name: "高端客户年度闭门会",
    owner: "陈鹏",
    objective: "面向核心客户展示年度产品战略，并沉淀下一年度联合增长线索。",
    budget: 650000,
    startDate: "2026-07-08",
    endDate: "2026-08-18",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }],
    items: [
      { workstream: "客户策略", name: "确定客户分层与邀约策略", description: "根据客户潜力和合作成熟度分层邀约。", notes: "Top 20 客户名单已完成。", assignee: "陈鹏", department: "客户发展", deadline: "2026-07-14", priority: "P0", status: "COMPLETED" },
      { workstream: "内容策划", name: "完成闭门会主题内容框架", description: "形成产品战略、案例与圆桌议题的内容逻辑。", notes: "内容框架通过，进入演讲稿撰写。", assignee: "许闻澜", department: "市场战略", deadline: "2026-07-22", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "客户运营", name: "跟进重点客户出席确认", description: "确保重点客户 RSVP 与高层接待安排完成。", notes: "已有 13 家确认出席。", assignee: "陈鹏", department: "客户发展", deadline: "2026-08-03", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "会后转化", name: "输出客户行动清单", description: "将现场反馈转化为客户机会与下一步负责人。", notes: "会后行动清单模板已锁定，活动结束后按既定流程执行。", assignee: "陈鹏", department: "客户发展", deadline: "2026-08-20", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "闭门会预算池。", notes: "预算已确认，按实际发生持续记账。", assignee: "陈鹏", department: "经营管理", deadline: "2026-07-16", priority: "P2", status: "PENDING" },
    ],
    calendar: [
      { task: "完成闭门会主题内容框架", date: "2026-08-16", startTime: "14:00", channel: "上海外滩会所", content: "客户年度闭门会", owner: "陈鹏", department: "客户发展", status: "PLANNED" },
      { task: "输出客户行动清单", date: "2026-08-20", startTime: "10:00", channel: "上海外滩会所", content: "会后客户机会复盘", owner: "陈鹏", department: "客户发展", status: "PLANNED" },
    ],
    budgetFlows: [],
  },
  {
    name: "品牌危机响应演练",
    owner: "陈鹏",
    objective: "验证品牌、法务、客服和管理层在高压舆情场景下的协同响应效率。",
    budget: 180000,
    startDate: "2026-06-25",
    endDate: "2026-07-30",
    collaborators: [{ name: "许闻澜", role: "VIEWER" }],
    items: [
      { workstream: "预案设计", name: "完成危机场景脚本", description: "覆盖产品质量、服务投诉和高管言论三类场景。", notes: "三类脚本已经法务确认。", assignee: "陈鹏", department: "品牌公关", deadline: "2026-07-05", priority: "P0", status: "COMPLETED" },
      { workstream: "跨部门协同", name: "确认演练参演人和联络树", description: "明确品牌、法务、客服和高管办公室的响应责任。", notes: "客服团队尚未确认夜间值班代表。", assignee: "陈鹏", department: "品牌公关", deadline: "2026-07-12", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "演练执行", name: "执行桌面推演", description: "以 90 分钟桌面推演验证响应链条。", notes: "已完成第一次演练，需补充媒体问询话术。", assignee: "陈鹏", department: "品牌公关", deadline: "2026-07-18", priority: "P0", status: "COMPLETED" },
      { workstream: "复盘整改", name: "提交演练整改清单", description: "沉淀问题、责任人与整改截止日期。", notes: "法务审阅周期超过预期。", assignee: "陈鹏", department: "品牌公关", deadline: "2026-07-08", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "演练项目预算池。", notes: "超出原计划，需要确认后续增补。", assignee: "陈鹏", department: "经营管理", deadline: "2026-07-02", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "执行桌面推演", date: "2026-07-18", startTime: "15:00", channel: "总部 12F 战情室", content: "品牌危机响应桌面推演", owner: "陈鹏", department: "品牌公关", status: "DONE" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 180000, description: "危机响应演练预算确定", createdBy: "陈鹏" },
      { task: "完成危机场景脚本", operation: "EXPENSE", flowType: "EXPENSE", amount: -95000, description: "外部危机顾问与脚本设计", createdBy: "陈鹏" },
      { task: "执行桌面推演", operation: "EXPENSE", flowType: "EXPENSE", amount: -120000, description: "演练场地、录制与复盘服务", createdBy: "陈鹏" },
    ],
  },
  {
    name: "Aster X9 国内上市整合传播",
    owner: "周予安",
    objective: "围绕新品上市打造媒体声量、内容资产和用户转化的一体化传播闭环。",
    budget: 5200000,
    startDate: "2026-07-01",
    endDate: "2026-09-15",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }, { name: "陈鹏", role: "VIEWER" }],
    items: [
      { workstream: "策略统筹", name: "确认上市传播策略与节奏", description: "统一预热、发布、持续传播三个阶段的核心叙事。", notes: "策略会已通过，待客户签字版本。", assignee: "周予安", department: "整合营销", deadline: "2026-07-12", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "媒体公关", name: "完成核心媒体沟通与专访排期", description: "锁定汽车、科技、财经媒体的专访与试驾资源。", notes: "8 家媒体确认，2 家档期冲突。", assignee: "周予安", department: "品牌公关", deadline: "2026-07-25", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "社交内容", name: "完成首批社媒内容资产", description: "输出产品卖点短视频、长图文和互动话题素材。", notes: "首批 6 条短视频完成内审。", assignee: "许闻澜", department: "内容营销", deadline: "2026-07-20", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "用户运营", name: "配置上市期线索承接机制", description: "打通预约、试驾、CRM 回传和销售跟进。", notes: "CRM 字段映射已锁定，按测试数据验证回传链路。", assignee: "罗嘉言", department: "用户运营", deadline: "2026-07-30", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "新品上市确认预算池。", notes: "预算已确认，包含内容与媒体资源。", assignee: "周予安", department: "整合营销", deadline: "2026-07-08", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "完成核心媒体沟通与专访排期", date: "2026-07-22", startTime: "10:00", channel: "北京试驾基地", content: "核心媒体预沟通与试驾", owner: "周予安", department: "品牌公关", status: "CONFIRMED" },
      { task: "完成首批社媒内容资产", date: "2026-07-28", startTime: "12:00", channel: "小红书 / 抖音 / 视频号", content: "Aster X9 首批预热内容上线", owner: "许闻澜", department: "内容营销", status: "PLANNED" },
      { task: "配置上市期线索承接机制", date: "2026-08-08", startTime: "19:30", channel: "官网 / 小程序", content: "新品发布会直播与预约承接", owner: "罗嘉言", department: "用户运营", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 5200000, description: "Aster X9 上市整合传播预算确定", createdBy: "周予安" },
      { task: "完成核心媒体沟通与专访排期", operation: "EXPENSE", flowType: "EXPENSE", amount: -760000, description: "媒体试驾与专访资源预付款", createdBy: "周予安" },
      { task: "完成首批社媒内容资产", operation: "EXPENSE", flowType: "EXPENSE", amount: -980000, description: "内容制作与社媒资源采购", createdBy: "许闻澜" },
      { task: "完成首批社媒内容资产", operation: "REFUND", flowType: "REFUND", amount: 60000, description: "达人档期调整退款", createdBy: "许闻澜" },
    ],
  },
  {
    name: "华东经销商增长计划",
    owner: "周予安",
    objective: "通过区域零售活动、销售赋能和线索运营提升华东经销商到店与试驾转化。",
    budget: 2300000,
    startDate: "2026-07-10",
    endDate: "2026-10-31",
    collaborators: [{ name: "许闻澜", role: "VIEWER" }],
    items: [
      { workstream: "区域策略", name: "完成城市优先级与门店分组", description: "按销量潜力和库存压力划分 12 个重点城市。", notes: "城市分组完成，待大区签字。", assignee: "周予安", department: "区域营销", deadline: "2026-07-17", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "零售活动", name: "发布周末试驾活动模板", description: "统一门店物料、活动机制和数据回传口径。", notes: "首版模板待销售培训反馈。", assignee: "周予安", department: "区域营销", deadline: "2026-07-24", priority: "P1", status: "PENDING" },
      { workstream: "销售赋能", name: "完成经销商产品话术培训", description: "覆盖产品卖点、竞品对比和试驾转化话术。", notes: "讲师与场次已排定，按区域分批交付。", assignee: "方明澈", department: "销售培训", deadline: "2026-08-03", priority: "P1", status: "PENDING" },
      { workstream: "数据运营", name: "建立门店线索周报", description: "每周汇总到店、试驾、成交和异常门店。", notes: "已确定数据字段。", assignee: "周予安", department: "数据运营", deadline: "2026-07-31", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "区域增长计划预算池。", notes: "计划预算待区域财务确认。", assignee: "周予安", department: "区域营销", deadline: "2026-07-15", priority: "P2", status: "PENDING" },
    ],
    calendar: [
      { task: "发布周末试驾活动模板", date: "2026-07-26", startTime: "09:00", channel: "华东重点门店", content: "首轮周末试驾活动上线", owner: "周予安", department: "区域营销", status: "PLANNED" },
      { task: "完成经销商产品话术培训", date: "2026-08-03", startTime: "15:00", channel: "线上培训", content: "经销商产品话术培训", owner: "方明澈", department: "销售培训", status: "PLANNED" },
    ],
    budgetFlows: [],
  },
  {
    name: "成都车展品牌体验馆",
    owner: "周予安",
    objective: "在成都车展打造沉浸式品牌体验馆，强化新车型和智能技术心智。",
    budget: 3100000,
    startDate: "2026-06-20",
    endDate: "2026-08-30",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }, { name: "陈鹏", role: "VIEWER" }],
    items: [
      { workstream: "空间设计", name: "确认体验馆空间方案", description: "完成主视觉、展车、互动装置和休息区方案。", notes: "空间方案已锁定。", assignee: "周予安", department: "品牌体验", deadline: "2026-07-02", priority: "P0", status: "COMPLETED" },
      { workstream: "供应商管理", name: "签订搭建与互动装置合同", description: "确认供应商排期、交付标准和安全责任。", notes: "互动装置供应商报价待最终谈判。", assignee: "周予安", department: "采购", deadline: "2026-07-14", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "内容体验", name: "制作展台互动内容", description: "制作车型互动屏、技术讲解和打卡内容。", notes: "互动脚本完成 70%。", assignee: "许闻澜", department: "内容营销", deadline: "2026-07-25", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "现场运营", name: "完成展期人员排班", description: "安排接待、讲解、销售线索和应急岗位。", notes: "需等待最终展馆开放时间。", assignee: "周予安", department: "品牌体验", deadline: "2026-08-08", priority: "P1", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "体验馆预算池。", notes: "存在支出，预算确定尚未补录。", assignee: "周予安", department: "品牌体验", deadline: "2026-07-01", priority: "P0", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "签订搭建与互动装置合同", date: "2026-07-16", startTime: "11:00", channel: "成都世纪城展馆", content: "展台搭建进场确认", owner: "周予安", department: "采购", status: "CONFIRMED" },
      { task: "完成展期人员排班", date: "2026-08-28", startTime: "09:00", channel: "成都车展", content: "成都车展品牌体验馆开馆", owner: "周予安", department: "品牌体验", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "签订搭建与互动装置合同", operation: "EXPENSE", flowType: "EXPENSE", amount: -680000, description: "展台搭建预付款，待正式预算确认", createdBy: "周予安" },
      { task: "制作展台互动内容", operation: "EXPENSE", flowType: "EXPENSE", amount: -320000, description: "互动内容制作首付款", createdBy: "许闻澜" },
    ],
  },
  {
    name: "智能驾驶用户共创营",
    owner: "周予安",
    objective: "邀请真实用户参与智能驾驶功能体验与共创，沉淀产品反馈和可传播内容。",
    budget: 760000,
    startDate: "2026-07-12",
    endDate: "2026-08-25",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }],
    items: [
      { workstream: "用户招募", name: "筛选共创营用户名单", description: "按驾驶经验、车型和城市完成 30 人筛选。", notes: "已筛选 42 人候选，待电话确认。", assignee: "周予安", department: "用户运营", deadline: "2026-07-18", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "活动设计", name: "设计试驾与共创议程", description: "覆盖功能体验、反馈工作坊和安全说明。", notes: "产品团队正在补充体验任务。", assignee: "周予安", department: "用户运营", deadline: "2026-07-22", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "内容传播", name: "完成用户故事采集方案", description: "确定访谈、拍摄授权和内容发布边界。", notes: "授权书待法务确认。", assignee: "许闻澜", department: "内容营销", deadline: "2026-07-26", priority: "P1", status: "PENDING" },
      { workstream: "产品反馈", name: "整理功能反馈优先级", description: "将用户共创反馈同步至产品团队并标注优先级。", notes: "待活动结束后执行。", assignee: "周予安", department: "产品运营", deadline: "2026-08-22", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "共创营预算池。", notes: "预算确认后发生一次退款。", assignee: "周予安", department: "用户运营", deadline: "2026-07-14", priority: "P2", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "设计试驾与共创议程", date: "2026-08-15", startTime: "09:30", channel: "上海智能驾驶体验中心", content: "智能驾驶用户共创营第一期", owner: "周予安", department: "用户运营", status: "PLANNED" },
      { task: "完成用户故事采集方案", date: "2026-08-16", startTime: "14:00", channel: "视频号 / 社区", content: "用户共创故事素材采集", owner: "许闻澜", department: "内容营销", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 760000, description: "智能驾驶用户共创营预算确定", createdBy: "周予安" },
      { task: "筛选共创营用户名单", operation: "EXPENSE", flowType: "EXPENSE", amount: -150000, description: "用户招募与交通补贴", createdBy: "周予安" },
      { task: "完成用户故事采集方案", operation: "EXPENSE", flowType: "EXPENSE", amount: -220000, description: "用户故事拍摄预付款", createdBy: "许闻澜" },
      { task: "完成用户故事采集方案", operation: "REFUND", flowType: "REFUND", amount: 30000, description: "拍摄档期调整退款", createdBy: "许闻澜" },
    ],
  },
  {
    name: "Q3客户案例内容增长计划",
    owner: "周予安",
    objective: "系统化沉淀客户案例，支撑销售转化、行业影响力与品牌内容供给。",
    budget: 480000,
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }],
    items: [
      { workstream: "案例策略", name: "确定案例选题池", description: "从行业、客户规模和产品价值筛选 10 个案例。", notes: "第一批 6 个案例已获销售确认。", assignee: "周予安", department: "内容营销", deadline: "2026-07-13", priority: "P1", status: "COMPLETED" },
      { workstream: "内容生产", name: "完成三篇深度客户案例", description: "输出访谈、文稿、视觉和审批版本。", notes: "第一篇进入客户审阅。", assignee: "许闻澜", department: "内容营销", deadline: "2026-07-29", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "分发运营", name: "建立案例分发节奏", description: "覆盖官网、公众号、销售资料和行业媒体。", notes: "渠道优先级已确认。", assignee: "周予安", department: "内容营销", deadline: "2026-08-05", priority: "P2", status: "PENDING" },
      { workstream: "销售协同", name: "配置销售案例使用指引", description: "为销售团队提供行业/场景检索与使用话术。", notes: "销售案例使用指引已纳入 enablement 发布节奏。", assignee: "方明澈", department: "销售赋能", deadline: "2026-08-12", priority: "P2", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "内容增长预算池。", notes: "已确认预算，准备拆分至内容生产。", assignee: "周予安", department: "内容营销", deadline: "2026-07-05", priority: "P2", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "完成三篇深度客户案例", date: "2026-07-30", startTime: "10:00", channel: "官网 / 公众号", content: "客户案例第一篇发布", owner: "许闻澜", department: "内容营销", status: "PLANNED" },
      { task: "建立案例分发节奏", date: "2026-08-06", startTime: "10:00", channel: "销售内容库", content: "案例销售资料包上线", owner: "周予安", department: "内容营销", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 480000, description: "Q3 客户案例内容预算确定", createdBy: "周予安" },
      { task: "完成三篇深度客户案例", operation: "EXPENSE", flowType: "EXPENSE", amount: -140000, description: "案例采访与文字制作", createdBy: "许闻澜" },
      { task: "完成三篇深度客户案例", operation: "TRANSFER", flowType: "ALLOCATE", amount: -50000, description: "从内容生产划拨至分发设计", createdBy: "周予安" },
      { task: "建立案例分发节奏", operation: "TRANSFER", flowType: "ALLOCATE", amount: 50000, description: "从内容生产划拨至分发设计", createdBy: "周予安" },
    ],
  },
  {
    name: "欧洲市场进入传播项目",
    owner: "许闻澜",
    objective: "为欧洲市场进入建立统一的品牌叙事、媒体关系和本地化内容资产。",
    budget: 4400000,
    startDate: "2026-07-03",
    endDate: "2026-10-20",
    collaborators: [{ name: "周予安", role: "EDITOR" }, { name: "陈鹏", role: "VIEWER" }],
    items: [
      { workstream: "市场策略", name: "确认欧洲市场叙事框架", description: "统一品牌定位、产品价值和本地沟通边界。", notes: "英国与德国叙事框架已合并。", assignee: "许闻澜", department: "国际市场", deadline: "2026-07-16", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "本地化内容", name: "完成英德双语内容本地化", description: "完成官网、新闻稿、FAQ 与社媒首批文案。", notes: "德语技术术语待产品审核。", assignee: "许闻澜", department: "国际内容", deadline: "2026-07-26", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "媒体公关", name: "建立欧洲媒体优先级清单", description: "覆盖汽车、科技、财经和生活方式媒体。", notes: "英国媒体清单完成，德国尚缺区域媒体。", assignee: "周予安", department: "国际公关", deadline: "2026-07-24", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "发布执行", name: "确认欧洲发布窗口", description: "确定发布会、试驾和线上内容的先后顺序。", notes: "受场地档期影响，窗口可能后移一周。", assignee: "许闻澜", department: "国际市场", deadline: "2026-08-02", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "欧洲市场进入预算池。", notes: "预算已确认，媒体资源正在采购。", assignee: "许闻澜", department: "国际市场", deadline: "2026-07-10", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "建立欧洲媒体优先级清单", date: "2026-07-23", startTime: "15:00", channel: "伦敦", content: "欧洲核心媒体线上简报", owner: "周予安", department: "国际公关", status: "CONFIRMED" },
      { task: "确认欧洲发布窗口", date: "2026-08-20", startTime: "19:00", channel: "柏林", content: "欧洲市场发布会", owner: "许闻澜", department: "国际市场", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 4400000, description: "欧洲市场进入传播预算确定", createdBy: "许闻澜" },
      { task: "完成英德双语内容本地化", operation: "EXPENSE", flowType: "EXPENSE", amount: -620000, description: "英德双语内容与设计制作", createdBy: "许闻澜" },
      { task: "建立欧洲媒体优先级清单", operation: "EXPENSE", flowType: "EXPENSE", amount: -380000, description: "欧洲媒体顾问与调研", createdBy: "周予安" },
    ],
  },
  {
    name: "城市限定快闪体验计划",
    owner: "许闻澜",
    objective: "在核心商圈用快闪体验测试年轻用户对新品和品牌互动内容的反馈。",
    budget: 980000,
    startDate: "2026-07-08",
    endDate: "2026-08-24",
    collaborators: [{ name: "周予安", role: "EDITOR" }],
    items: [
      { workstream: "场地运营", name: "锁定快闪场地与排期", description: "选择上海和杭州两座城市的高流量商圈。", notes: "上海场地已锁定，杭州仍在比价。", assignee: "许闻澜", department: "品牌体验", deadline: "2026-07-15", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "创意内容", name: "完成快闪互动装置创意", description: "设计打卡、互动、试驾预约和内容采集机制。", notes: "创意方案已进入制作报价。", assignee: "许闻澜", department: "创意内容", deadline: "2026-07-19", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "达人传播", name: "确认本地达人合作名单", description: "覆盖探店、汽车和生活方式达人。", notes: "首轮名单待品牌安全审核。", assignee: "周予安", department: "社交营销", deadline: "2026-07-25", priority: "P1", status: "PENDING" },
      { workstream: "数据复盘", name: "配置快闪数据看板", description: "跟踪客流、互动、留资、试驾预约与内容传播。", notes: "指标定义完成，门店数据按日同步至看板。", assignee: "罗嘉言", department: "数据运营", deadline: "2026-08-05", priority: "P1", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "快闪体验计划预算池。", notes: "预算已确认，场地费预付款已发生。", assignee: "许闻澜", department: "品牌体验", deadline: "2026-07-10", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "锁定快闪场地与排期", date: "2026-08-01", startTime: "10:00", channel: "上海前滩太古里", content: "城市限定快闪首站开幕", owner: "许闻澜", department: "品牌体验", status: "PLANNED" },
      { task: "确认本地达人合作名单", date: "2026-08-02", startTime: "14:00", channel: "小红书 / 抖音", content: "本地达人探店内容发布", owner: "周予安", department: "社交营销", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 980000, description: "城市限定快闪体验预算确定", createdBy: "许闻澜" },
      { task: "锁定快闪场地与排期", operation: "EXPENSE", flowType: "EXPENSE", amount: -290000, description: "上海场地与物业预付款", createdBy: "许闻澜" },
      { task: "完成快闪互动装置创意", operation: "EXPENSE", flowType: "EXPENSE", amount: -360000, description: "互动装置制作首付款", createdBy: "许闻澜" },
    ],
  },
  {
    name: "年度可持续发展报告传播",
    owner: "许闻澜",
    objective: "将年度可持续发展报告转化为可理解、可分发、可回应的品牌沟通资产。",
    budget: 560000,
    startDate: "2026-06-28",
    endDate: "2026-08-12",
    collaborators: [{ name: "陈鹏", role: "VIEWER" }],
    items: [
      { workstream: "报告内容", name: "完成报告核心叙事提炼", description: "从长报告中提炼三条核心叙事与证据链。", notes: "ESG 数据已核验，叙事待管理层确认。", assignee: "许闻澜", department: "品牌战略", deadline: "2026-07-11", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "视觉内容", name: "制作报告传播视觉资产", description: "制作长图、短视频、数据卡片和演讲模板。", notes: "首批数据卡片已完成。", assignee: "许闻澜", department: "创意内容", deadline: "2026-07-21", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "利益相关方", name: "安排媒体与机构沟通", description: "面向财经、ESG 媒体和行业机构组织沟通。", notes: "机构沟通名单与对接分工已进入执行节奏。", assignee: "许闻澜", department: "品牌公关", deadline: "2026-07-27", priority: "P1", status: "PENDING" },
      { workstream: "对外发布", name: "发布年度可持续发展报告", description: "官网发布、内外部邮件和社交内容同步。", notes: "待董事会确认发布时间。", assignee: "许闻澜", department: "品牌战略", deadline: "2026-08-08", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "报告传播预算池。", notes: "已确认预算，存在一笔供应商退款。", assignee: "许闻澜", department: "品牌战略", deadline: "2026-07-03", priority: "P2", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "安排媒体与机构沟通", date: "2026-07-27", startTime: "14:00", channel: "线上圆桌", content: "ESG 媒体与机构沟通会", owner: "许闻澜", department: "品牌公关", status: "PLANNED" },
      { task: "发布年度可持续发展报告", date: "2026-08-08", startTime: "09:00", channel: "官网 / 公众号 / LinkedIn", content: "年度可持续发展报告发布", owner: "许闻澜", department: "品牌战略", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 560000, description: "年度可持续发展报告传播预算确定", createdBy: "许闻澜" },
      { task: "制作报告传播视觉资产", operation: "EXPENSE", flowType: "EXPENSE", amount: -190000, description: "报告视觉与动效制作", createdBy: "许闻澜" },
      { task: "制作报告传播视觉资产", operation: "REFUND", flowType: "REFUND", amount: 18000, description: "未使用动效资源退款", createdBy: "许闻澜" },
    ],
  },
  {
    name: "开发者生态伙伴峰会",
    owner: "许闻澜",
    objective: "通过伙伴峰会发布生态能力、沉淀合作线索并建立后续技术社区运营机制。",
    budget: 1250000,
    startDate: "2026-07-15",
    endDate: "2026-09-10",
    collaborators: [{ name: "周予安", role: "VIEWER" }],
    items: [
      { workstream: "伙伴策略", name: "确定伙伴分层与峰会邀约名单", description: "锁定开发者、ISV、渠道和战略伙伴四类对象。", notes: "伙伴分层规则已确认。", assignee: "许闻澜", department: "生态合作", deadline: "2026-07-23", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "峰会内容", name: "完成主论坛议程与演讲人确认", description: "确认主题演讲、产品发布和伙伴圆桌。", notes: "两位外部嘉宾仍未确认。", assignee: "许闻澜", department: "生态合作", deadline: "2026-08-02", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "开发者运营", name: "建立会后开发者社区承接", description: "配置报名、资料下载、社群和技术问答入口。", notes: "社区工具与运营节奏已锁定，按峰会节点上线。", assignee: "罗嘉言", department: "开发者运营", deadline: "2026-08-12", priority: "P1", status: "PENDING" },
      { workstream: "现场执行", name: "完成峰会现场总控", description: "覆盖签到、直播、舞台、演示和应急流程。", notes: "待议程锁定后进入详细总控。", assignee: "许闻澜", department: "生态合作", deadline: "2026-09-04", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "伙伴峰会预算池。", notes: "预算确认，当前消耗偏高。", assignee: "许闻澜", department: "生态合作", deadline: "2026-07-18", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "完成主论坛议程与演讲人确认", date: "2026-08-05", startTime: "16:00", channel: "线上", content: "伙伴峰会演讲人联排", owner: "许闻澜", department: "生态合作", status: "PLANNED" },
      { task: "完成峰会现场总控", date: "2026-09-05", startTime: "09:00", channel: "深圳湾万象城", content: "开发者生态伙伴峰会", owner: "许闻澜", department: "生态合作", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 1250000, description: "开发者生态伙伴峰会预算确定", createdBy: "许闻澜" },
      { task: "完成主论坛议程与演讲人确认", operation: "EXPENSE", flowType: "EXPENSE", amount: -520000, description: "场地、舞美与直播资源", createdBy: "许闻澜" },
      { task: "完成峰会现场总控", operation: "EXPENSE", flowType: "EXPENSE", amount: -470000, description: "执行团队与现场服务", createdBy: "许闻澜" },
    ],
  },
  {
    name: "秋季新品社交内容战役",
    owner: "许闻澜",
    objective: "用连续主题内容建立新品讨论度，并驱动预约与门店到访。",
    budget: 1600000,
    startDate: "2026-07-05",
    endDate: "2026-09-25",
    collaborators: [{ name: "周予安", role: "EDITOR" }],
    items: [
      { workstream: "内容策略", name: "制定八周内容主题排期", description: "规划功能、场景、用户故事和热点四类主题。", notes: "内容主题完成，待确认品牌敏感词。", assignee: "许闻澜", department: "社交营销", deadline: "2026-07-14", priority: "P0", status: "IN_PROGRESS" },
      { workstream: "达人合作", name: "签约首批垂类达人", description: "完成汽车、科技、生活方式达人合作与 Brief。", notes: "已签 12 位，待补充 3 位城市达人。", assignee: "周予安", department: "社交营销", deadline: "2026-07-21", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "账号运营", name: "完成官方账号内容生产机制", description: "建立周选题、审核、发布和复盘节奏。", notes: "首周内容已排期。", assignee: "许闻澜", department: "社交营销", deadline: "2026-07-18", priority: "P1", status: "IN_PROGRESS" },
      { workstream: "转化承接", name: "接入社交线索转化看板", description: "追踪内容互动、预约和线索成本。", notes: "数据口径已统一，按周复盘内容到线索的转化表现。", assignee: "罗嘉言", department: "数据运营", deadline: "2026-07-29", priority: "P0", status: "PENDING" },
      { workstream: "预算统筹", name: "项目统筹预算池", description: "社交内容战役预算池。", notes: "已确认预算，达人资源已发生支出。", assignee: "许闻澜", department: "社交营销", deadline: "2026-07-08", priority: "P1", status: "IN_PROGRESS" },
    ],
    calendar: [
      { task: "完成官方账号内容生产机制", date: "2026-07-20", startTime: "12:00", channel: "小红书 / 抖音 / 视频号", content: "秋季新品内容战役第一周上线", owner: "许闻澜", department: "社交营销", status: "PLANNED" },
      { task: "签约首批垂类达人", date: "2026-07-27", startTime: "18:00", channel: "小红书", content: "首批达人新品体验内容发布", owner: "周予安", department: "社交营销", status: "PLANNED" },
    ],
    budgetFlows: [
      { task: "项目统筹预算池", operation: "CONFIRM", flowType: "ALLOCATE", amount: 1600000, description: "秋季新品社交内容战役预算确定", createdBy: "许闻澜" },
      { task: "签约首批垂类达人", operation: "EXPENSE", flowType: "EXPENSE", amount: -680000, description: "首批垂类达人合作", createdBy: "周予安" },
      { task: "完成官方账号内容生产机制", operation: "EXPENSE", flowType: "EXPENSE", amount: -240000, description: "内容制作与账号运营", createdBy: "许闻澜" },
    ],
  },
  buildGeneratedScenario({
    name: "新能源区域巡展项目",
    owner: "方明澈",
    objective: "在四座重点城市完成新能源车型巡展、试驾承接和区域线索转化。",
    budget: 1800000,
    startDate: "2026-07-11",
    endDate: "2026-09-18",
    collaborators: [{ name: "周予安", role: "EDITOR" }, { name: "罗嘉言", role: "VIEWER" }],
    strategyItem: "确认四城巡展节奏与总控表",
    executionWorkstream: "区域执行",
    executionItem: "完成上海首站巡展搭建与试驾承接",
    executionDepartment: "区域营销",
    executionDate: "2026-07-26",
    partnerWorkstream: "供应商管理",
    partnerItem: "确认巡展搭建供应商交付承诺",
    partnerOwner: "岚桥会展项目组",
    partnerDepartment: "外部供应商",
    partnerDate: "2026-07-19",
    measurementItem: "建立城市巡展线索复盘看板",
    measurementOwner: "罗嘉言",
    measurementDepartment: "数据运营",
    budgetState: "NORMAL",
  }),
  buildGeneratedScenario({
    name: "客户试驾体验运营升级",
    owner: "方明澈",
    objective: "优化高意向客户从预约、到店、试驾到销售回访的完整体验。",
    budget: 920000,
    startDate: "2026-07-08",
    endDate: "2026-08-30",
    collaborators: [{ name: "罗嘉言", role: "EDITOR" }],
    strategyItem: "确认试驾体验关键旅程与服务标准",
    executionWorkstream: "门店运营",
    executionItem: "上线重点门店试驾接待 SOP",
    executionDepartment: "零售运营",
    executionDate: "2026-07-23",
    partnerWorkstream: "客户协同",
    partnerItem: "确认经销商试驾资源与回访机制",
    partnerOwner: "王启航（经销商客户）",
    partnerDepartment: "渠道合作",
    partnerDate: "2026-07-28",
    measurementItem: "复盘试驾到成交转化链路",
    measurementOwner: null,
    measurementDepartment: "销售数据",
    budgetState: "NORMAL",
  }),
  buildGeneratedScenario({
    name: "Q4销售战役内容支持",
    owner: "方明澈",
    objective: "为 Q4 区域销售战役提供产品话术、内容物料和线索承接支持。",
    budget: 640000,
    startDate: "2026-07-15",
    endDate: "2026-10-10",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }, { name: "陈鹏", role: "VIEWER" }],
    strategyItem: "完成销售战役内容需求分层",
    executionWorkstream: "内容生产",
    executionItem: "交付首批区域销售内容包",
    executionDepartment: "销售赋能",
    executionDate: "2026-07-31",
    partnerWorkstream: "销售协同",
    partnerItem: "确认大区销售负责人验收口径",
    partnerOwner: "唐牧（华南大区）",
    partnerDepartment: "销售团队",
    partnerDate: "2026-08-04",
    measurementItem: "建立内容使用率与线索贡献复盘",
    measurementOwner: "方明澈",
    measurementDepartment: "销售赋能",
    budgetState: "NORMAL",
  }),
  buildGeneratedScenario({
    name: "年度产品培训直播季",
    owner: "方明澈",
    objective: "通过系列直播完成新产品与销售话术培训，并追踪参训后的实际使用效果。",
    budget: 780000,
    startDate: "2026-07-06",
    endDate: "2026-09-05",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }, { name: "周予安", role: "VIEWER" }],
    strategyItem: "锁定培训直播季主题与参训名单",
    executionWorkstream: "培训执行",
    executionItem: "完成第一场产品培训直播",
    executionDepartment: "销售培训",
    executionDate: "2026-07-21",
    partnerWorkstream: "讲师管理",
    partnerItem: "确认外部讲师与直播技术团队排期",
    partnerOwner: "黎川（培训讲师）",
    partnerDepartment: "外部讲师",
    partnerDate: "2026-07-17",
    measurementItem: "建立参训完成率与问答复盘机制",
    measurementOwner: "许闻澜",
    measurementDepartment: "内容营销",
    budgetState: "HIGH_USAGE",
  }),
  buildGeneratedScenario({
    name: "企业视频号增长运营",
    owner: "罗嘉言",
    objective: "建立企业视频号的稳定内容供给、直播协同和线索转化运营机制。",
    budget: 880000,
    startDate: "2026-07-04",
    endDate: "2026-09-28",
    collaborators: [{ name: "许闻澜", role: "EDITOR" }, { name: "方明澈", role: "VIEWER" }],
    strategyItem: "确认视频号增长目标与栏目矩阵",
    executionWorkstream: "账号运营",
    executionItem: "上线视频号第一轮栏目内容",
    executionDepartment: "社交营销",
    executionDate: "2026-07-18",
    partnerWorkstream: "内容合作",
    partnerItem: "确认 MCN 内容共创与投流节奏",
    partnerOwner: "星河 MCN 项目组",
    partnerDepartment: "外部供应商",
    partnerDate: "2026-07-22",
    measurementItem: "搭建视频号内容与线索增长看板",
    measurementOwner: "罗嘉言",
    measurementDepartment: "数据运营",
    budgetState: "NORMAL",
  }),
  buildGeneratedScenario({
    name: "智能座舱内容共创计划",
    owner: "罗嘉言",
    objective: "通过产品团队、用户和内容创作者共创，验证智能座舱核心功能的表达方式。",
    budget: 1100000,
    startDate: "2026-07-12",
    endDate: "2026-09-12",
    collaborators: [{ name: "方明澈", role: "EDITOR" }, { name: "周予安", role: "VIEWER" }],
    strategyItem: "确认智能座舱共创主题与样本用户",
    executionWorkstream: "内容共创",
    executionItem: "完成首轮智能座舱共创拍摄",
    executionDepartment: "内容创新",
    executionDate: "2026-07-29",
    partnerWorkstream: "产品协同",
    partnerItem: "确认产品团队功能演示支持",
    partnerOwner: "贺川（产品经理）",
    partnerDepartment: "产品团队",
    partnerDate: "2026-07-24",
    measurementItem: "整理共创内容反馈与功能理解度",
    measurementOwner: "方明澈",
    measurementDepartment: "用户研究",
    budgetState: "NORMAL",
  }),
  buildGeneratedScenario({
    name: "上海用户社群周年活动",
    owner: "罗嘉言",
    objective: "以周年活动提升核心用户社群活跃度，并收集可用于产品和传播的真实反馈。",
    budget: 520000,
    startDate: "2026-07-09",
    endDate: "2026-08-16",
    collaborators: [{ name: "方明澈", role: "EDITOR" }],
    strategyItem: "确认周年活动主题与用户分层邀约",
    executionWorkstream: "社群运营",
    executionItem: "完成周年活动现场执行总控",
    executionDepartment: "用户运营",
    executionDate: "2026-08-08",
    partnerWorkstream: "社群合作",
    partnerItem: "确认城市社群主理人与活动资源",
    partnerOwner: "孟然（社群主理人）",
    partnerDepartment: "用户社群",
    partnerDate: null,
    measurementItem: "复盘社群活动满意度与内容产出",
    measurementOwner: null,
    measurementDepartment: "用户运营",
    budgetState: "NORMAL",
  }),
  buildGeneratedScenario({
    name: "行业媒体趋势论坛",
    owner: "罗嘉言",
    objective: "组织行业媒体趋势论坛，沉淀品牌观点、媒体关系和后续选题机会。",
    budget: 960000,
    startDate: "2026-07-14",
    endDate: "2026-09-02",
    collaborators: [{ name: "周予安", role: "EDITOR" }, { name: "陈鹏", role: "VIEWER" }],
    strategyItem: "确定趋势论坛议题与嘉宾组合",
    executionWorkstream: "论坛执行",
    executionItem: "完成趋势论坛现场与直播执行",
    executionDepartment: "品牌公关",
    executionDate: "2026-08-26",
    partnerWorkstream: "媒体合作",
    partnerItem: "确认主办媒体与编辑部资源置换",
    partnerOwner: "Marta（行业媒体编辑）",
    partnerDepartment: "媒体合作",
    partnerDate: "2026-08-12",
    measurementItem: "建立论坛传播与媒体关系复盘",
    measurementOwner: "罗嘉言",
    measurementDepartment: "品牌公关",
    budgetState: "HIGH_USAGE",
  }),
];

function toDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function activityTimestamp(scenarioIndex: number, offsetMinutes: number) {
  return new Date(Date.now() - (scenarioIndex * 53 + offsetMinutes) * 60 * 1000);
}

function lifecycleForScenario(name: string): SeedProjectLifecycle {
  return LIFECYCLE_BY_PROJECT[name] ?? "ACTIVE";
}

function completeBudgetFlows(scenario: ProjectScenario, owner: DemoUserName): BudgetItem[] {
  const budgetTask = "__PROJECT_POOL__";
  const hasConfirmedBudget = scenario.budgetFlows.some((flow) => flow.flowType === "ALLOCATE");
  return hasConfirmedBudget
    ? scenario.budgetFlows
    : [{ task: budgetTask, operation: "CONFIRM", flowType: "ALLOCATE", amount: scenario.budget, description: `${scenario.name}预算确定`, createdBy: owner }, ...scenario.budgetFlows];
}

async function assertDemoDataComplete() {
  const [incompleteTasks, incompleteCalendarEntries, unconfirmedBudgetProjects] = await Promise.all([
    prisma.task.count({ where: { OR: [{ needsConfirmation: true }, { assignee: null }, { deadline: null }] } }),
    prisma.executionCalendarEntry.count({ where: { OR: [{ date: null }, { owner: null }, { channel: null }] } }),
    prisma.project.count({ where: { budgetStatus: { not: "CONFIRMED" } } }),
  ]);

  if (incompleteTasks || incompleteCalendarEntries || unconfirmedBudgetProjects) {
    throw new Error(`Demo dataset integrity failed: tasks=${incompleteTasks}, calendar=${incompleteCalendarEntries}, budget=${unconfirmedBudgetProjects}`);
  }
}

function upcomingDate(scenarioIndex: number, offsetDays: number) {
  return new Date(Date.UTC(2026, 7, 10 + scenarioIndex + offsetDays));
}

async function resetDemoData() {
  await prisma.projectFeedback.deleteMany();
  await prisma.projectFocus.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.executionCalendarEntry.deleteMany();
  await prisma.budgetFlow.deleteMany();
  await prisma.progressLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  if (process.env.SHADOWPM_ALLOW_DEMO_SEED !== "1") {
    throw new Error("演示数据重置已被保护。仅可通过 npm run db:seed:demo 在一次性开发数据库执行。");
  }
  console.log("Resetting ShadowPM demo data...");
  await resetDemoData();

  const users = new Map<string, { id: string; name: string }>();
  const demoPasswordHash = await hashPassword("ShadowPM-demo-2026!");
  for (const user of [
    { name: "陈鹏", email: "chen.peng@example.test", role: "LEADER" as const },
    { name: "周予安", email: "zhou.yuan@example.test", role: "MEMBER" as const },
    { name: "许闻澜", email: "xu.wenlan@example.test", role: "MEMBER" as const },
    { name: "方明澈", email: "fang.mingche@example.test", role: "MEMBER" as const },
    { name: "罗嘉言", email: "luo.jiayan@example.test", role: "MEMBER" as const },
  ]) {
    const created = await prisma.user.create({ data: { ...user, passwordHash: demoPasswordHash } });
    users.set(created.name, created);
  }

  const projectIds = new Map<string, string>();
  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
    const scenario = scenarios[scenarioIndex]!;
    const owner = users.get(scenario.owner)!;
    const budgetFlows = completeBudgetFlows(scenario, scenario.owner);
    const lifecycle = lifecycleForScenario(scenario.name);
    const projectStartDate = lifecycle === "UPCOMING" ? upcomingDate(scenarioIndex, 0) : toDate(scenario.startDate);
    const projectEndDate = lifecycle === "UPCOMING" ? upcomingDate(scenarioIndex, 45) : toDate(scenario.endDate);
    const project = await prisma.project.create({
      data: {
        name: scenario.name,
        ownerId: owner.id,
        totalBudget: new Prisma.Decimal(scenario.budget),
        budgetStatus: "CONFIRMED",
        startDate: projectStartDate,
        endDate: projectEndDate,
      },
    });
    projectIds.set(scenario.name, project.id);
    const phaseByName = new Map<string, string>();
    const controlItems = scenario.items.filter((item) => item.name !== "项目统筹预算池");
    for (const workstream of Array.from(new Set(controlItems.map((item) => item.workstream)))) {
      const phase = await prisma.phase.create({
        data: { projectId: project.id, name: workstream, sortOrder: phaseByName.size },
      });
      phaseByName.set(workstream, phase.id);
    }

    const taskByName = new Map<string, { id: string; name: string }>();
    for (let itemIndex = 0; itemIndex < controlItems.length; itemIndex += 1) {
      const item = controlItems[itemIndex]!;
      const assignee = item.assignee ?? owner.name;
      const deadline = lifecycle === "UPCOMING" ? upcomingDate(scenarioIndex, itemIndex + 2) : toDate(item.deadline) ?? activityTimestamp(scenarioIndex, -24 - itemIndex);
      const status = lifecycle === "COMPLETED" ? "COMPLETED" : lifecycle === "UPCOMING" ? "PENDING" : item.status;
      const notes = lifecycle === "COMPLETED" ? `已完成并进入结算与复盘：${item.notes}` : lifecycle === "UPCOMING" ? `项目尚未启动：${item.notes}` : item.notes;
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          phaseId: phaseByName.get(item.workstream),
          name: item.name,
          description: item.description,
          notes,
          assignee,
          department: item.department,
          deadline,
          priority: item.priority,
          status,
          needsConfirmation: false,
          missingFields: [],
          aiConfidence: "high",
          sourceRef: null,
        },
      });
      taskByName.set(task.name, task);
      await prisma.progressLog.create({
        data: {
          taskId: task.id,
          content: notes,
          createdBy: item.assignee ?? owner.name,
        },
      });
    }

    for (const collaborator of scenario.collaborators ?? []) {
      const user = users.get(collaborator.name)!;
      await prisma.projectMember.create({
        data: { projectId: project.id, userId: user.id, role: collaborator.role, createdBy: owner.name },
      });
    }

    for (let entryIndex = 0; entryIndex < scenario.calendar.length; entryIndex += 1) {
      const entry = scenario.calendar[entryIndex]!;
      await prisma.executionCalendarEntry.create({
        data: {
          projectId: project.id,
          taskId: taskByName.get(entry.task)?.id ?? null,
          date: lifecycle === "UPCOMING" ? upcomingDate(scenarioIndex, entryIndex + 4) : toDate(entry.date) ?? activityTimestamp(scenarioIndex, -48 - entryIndex),
          startTime: entry.startTime ?? null,
          channel: entry.channel ?? "项目执行协同",
          workstream: scenario.items.find((item) => item.name === entry.task)?.workstream ?? null,
          content: entry.content,
          owner: entry.owner ?? owner.name,
          department: entry.department,
          status: lifecycle === "COMPLETED" ? "DONE" : lifecycle === "UPCOMING" ? "PLANNED" : entry.status,
          notes: entry.notes ?? null,
          createdBy: owner.name,
        },
      });
    }

    const transferGroups = new Map<string, string>();
    for (const flow of budgetFlows) {
      const task = taskByName.get(flow.task);
      const groupId = flow.operation === "TRANSFER"
        ? transferGroups.get(flow.description) ?? randomUUID()
        : null;
      if (groupId) transferGroups.set(flow.description, groupId);
      const isPoolFlow = flow.task === "__PROJECT_POOL__" || flow.task === "项目统筹预算池";
      if (!task && !isPoolFlow) throw new Error(`Missing budget task: ${scenario.name} / ${flow.task}`);
      const amount = new Prisma.Decimal(flow.amount).abs();
      await prisma.budgetFlow.create({
        data: {
          projectId: project.id,
          taskId: task?.id,
          groupId,
          operation: isPoolFlow ? "CONFIRM_POOL" : flow.flowType === "EXPENSE" ? "DISBURSE" : flow.operation,
          flowType: flow.flowType,
          amount,
          counterparty: flow.flowType === "EXPENSE" ? "模拟合作方" : null,
          description: flow.description,
          createdBy: flow.createdBy,
        },
      });
      if (task && flow.flowType === "EXPENSE") {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            budgetAmount: amount,
            budgetStatus: lifecycle === "COMPLETED" ? "ACCEPTED" : "DISBURSED",
            budgetRecipient: lifecycle === "COMPLETED" ? null : "模拟合作方",
          },
        });
      } else if (task && flow.flowType === "ALLOCATE" && amount.gt(0)) {
        await prisma.task.update({ where: { id: task.id }, data: { budgetAmount: amount, budgetStatus: "ALLOCATED" } });
      }
    }

    await prisma.activityLog.createMany({
      data: [
        {
          projectId: project.id,
          targetType: "PROJECT",
          targetId: project.id,
          changeType: "CREATE",
          source: "SYSTEM",
          createdBy: owner.name,
          summary: `创建模拟项目：${scenario.objective}`,
          afterState: { objective: scenario.objective, scenario: "模拟案例" },
          createdAt: activityTimestamp(scenarioIndex, 28),
        },
        {
          projectId: project.id,
          targetType: "CONTROL_ITEM",
          changeType: "IMPORT",
          source: "SYSTEM",
          createdBy: "ShadowPM Demo Seed",
          summary: `已生成 ${controlItems.length} 条管控事项、项目预算池与 ${budgetFlows.length} 条预算审计记录、${scenario.calendar.length} 条执行日历。`,
          afterState: { items: controlItems.length, budgetFlows: budgetFlows.length, calendar: scenario.calendar.length },
          createdAt: activityTimestamp(scenarioIndex, 24),
        },
        ...controlItems.map((item, itemIndex) => ({
          projectId: project.id,
          targetType: "CONTROL_ITEM",
          targetId: taskByName.get(item.name)?.id,
          changeType: lifecycle === "COMPLETED" || item.status === "COMPLETED" ? "STATUS_CHANGE" : "UPDATE",
          source: "HUMAN",
          createdBy: item.assignee ?? owner.name,
          summary: `更新管控事项「${item.name}」：${lifecycle === "COMPLETED" ? `已完成并进入结算与复盘：${item.notes}` : lifecycle === "UPCOMING" ? `项目尚未启动：${item.notes}` : item.notes}`,
          afterState: { status: lifecycle === "COMPLETED" ? "COMPLETED" : lifecycle === "UPCOMING" ? "PENDING" : item.status, needsConfirmation: false },
          createdAt: activityTimestamp(scenarioIndex, 20 - itemIndex * 2),
        })),
        ...budgetFlows.map((flow, flowIndex) => ({
          projectId: project.id,
          targetType: "BUDGET_ITEM",
          targetId: taskByName.get(flow.task)?.id,
          changeType: "UPDATE",
          source: "HUMAN",
          createdBy: flow.createdBy,
          summary: `资金账本已记录${flow.operation}：${flow.description}`,
          afterState: { operation: flow.operation, amount: flow.amount, flowType: flow.flowType },
          createdAt: activityTimestamp(scenarioIndex, 9 - flowIndex),
        })),
        ...scenario.calendar.map((entry, entryIndex) => ({
          projectId: project.id,
          targetType: "CALENDAR_ENTRY",
          targetId: taskByName.get(entry.task)?.id,
          changeType: "UPDATE",
          source: "HUMAN",
          createdBy: entry.owner ?? owner.name,
          summary: `执行日历已${lifecycle === "COMPLETED" || entry.status === "DONE" ? "完成" : entry.status === "CONFIRMED" ? "确认" : "更新"}：${entry.content}`,
          afterState: { status: lifecycle === "COMPLETED" ? "DONE" : lifecycle === "UPCOMING" ? "PLANNED" : entry.status, date: lifecycle === "UPCOMING" ? upcomingDate(scenarioIndex, entryIndex + 4).toISOString() : entry.date, channel: entry.channel },
          createdAt: activityTimestamp(scenarioIndex, 4 - entryIndex),
        })),
      ],
    });
  }

  await assertDemoDataComplete();

  const focusRows = Array.from(users.values()).flatMap((user) => {
    const ownProject = scenarios.find((scenario) => scenario.owner === user.name);
    const memberProject = scenarios.find((scenario) => scenario.collaborators?.some((collaborator) => collaborator.name === user.name));
    return [ownProject, memberProject]
      .filter((scenario): scenario is ProjectScenario => Boolean(scenario))
      .map((scenario) => ({ projectId: projectIds.get(scenario.name)!, userId: user.id }));
  });
  await prisma.projectFocus.createMany({ data: focusRows, skipDuplicates: true });

  const [userCount, projectCount, taskCount, budgetCount, calendarCount, logCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.budgetFlow.count(),
    prisma.executionCalendarEntry.count(),
    prisma.activityLog.count(),
  ]);
  console.log(`Demo dataset ready: ${userCount} users, ${projectCount} projects, ${taskCount} control items, ${budgetCount} budget flows, ${calendarCount} calendar entries, ${logCount} activity records.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Demo data reset failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
