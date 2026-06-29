# 目录结构规范

```text
src/
├── app/
│   ├── (auth)/login/page.tsx      // 简易鉴权入口
│   ├── dashboard/page.tsx         // LEADER 全局大盘页面
│   ├── workspace/page.tsx         // MEMBER 个人项目列表页面
│   └── projects/[id]/page.tsx     // 核心：项目详情控制台 (任务/时间轴/账单/Wiki)
├── components/
│   ├── ui/                        // Shadcn 自动生成的组件库
│   ├── layout/                    // 侧边栏 Sidebar、顶栏 Header
│   ├── dashboard/                 // ECharts 数据统计卡片
│   ├── project/                   
│   │   ├── TaskList.tsx           // 任务树组件
│   │   ├── TimelineView.tsx       // 历史进度倒序组件
│   │   └── LedgerTable.tsx        // 资金流水账单组件
│   └── wiki/
│       ├── FolderTree.tsx         // 目录树组件
│       └── AssetViewer.tsx        // 资产预览组件
├── lib/
│   ├── prisma.ts                  // Prisma 单例
│   ├── utils.ts                   // cn() 拼接、金额千分位格式化
│   └── constants.ts               // 角色权限常量
└── actions/                       // 所有后端的 Server Actions
```
