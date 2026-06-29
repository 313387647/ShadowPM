# 总体项目设定 (Project Context)

## 1. 项目愿景 (ShadowPM)
本项目是一个为营销/公关团队量身定制的"轻量级智能项目管控系统"。旨在替代公司繁冗的 OA 审批系统和极易混乱的 Excel 表格。
核心理念：极简录入、账目清白、历史可溯、资产内聚、AI 赋能。

## 2. 强制技术栈 (Tech Stack)
你必须严格遵守以下技术栈进行代码编写，绝不可使用替代品：
- **核心框架**: Next.js 14 (强制使用 App Router，绝对不要使用 Pages Router)
- **后端逻辑**: Next.js Server Actions (完全在 Node.js 环境执行，不写传统的 API Routes)
- **前端库**: React 18
- **样式方案**: Tailwind CSS
- **UI 组件库**: Shadcn UI (配合 Lucide React 图标)
- **数据库 ORM**: Prisma
- **关系型数据库**: PostgreSQL
- **图表库**: Apache ECharts (用于大盘渲染)

## 3. 编码"军规" (Golden Rules)
- **极简主义**: 代码要求模块化、高内聚，尽量复用 Shadcn UI 组件。避免过度封装。
- **状态管理**: 尽量依赖 React Server Components (RSC) 获取数据，客户端状态仅使用 React 自身 Hook (`useState`, `useOptimistic`)，禁止引入 Redux 等重型库。
- **类型安全**: 严格使用 TypeScript，确保 Server Actions 的入参和返回值都有明确的 Type 定义。
- **无复杂审批**: 系统绝对不包含任何"提交审核-领导驳回"的 OA 式流转。
