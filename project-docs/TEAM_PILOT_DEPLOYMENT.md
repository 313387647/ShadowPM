# ShadowPM 团队试运营运行手册

ShadowPM 面向一个内部团队和一套正式实例。它不引入组织、多租户或企业 SSO；项目成员关系就是唯一的项目级授权边界。

完整的腾讯云 CVM 上手步骤见 [TENCENT_CVM_DEPLOYMENT.md](./TENCENT_CVM_DEPLOYMENT.md)。本页说明上线后的运行规则。

## 固定架构

```text
团队成员浏览器
       |
HTTPS + 业务域名
       |
Nginx 反向代理
       |
ShadowPM Docker 容器
       |
同一 CVM 上的独立 PostgreSQL 容器
```

- 只运行一个 ShadowPM 实例和一套 PostgreSQL。
- 应用端口 `3000` 与数据库端口 `5432` 不向公网开放。Nginx 仅代理到本机 `127.0.0.1:3000`。
- PostgreSQL 是项目、预算、日历、日志和权限的唯一真相来源，运行在独立 Docker 容器与持久化数据卷中。
- 原始导入文件不进入 PostgreSQL；目前只保存用于可追溯的有界提取文本。需要长期保存原文件时，再接入对象存储。

## 数据库规则

正式库从空 PostgreSQL 容器和仓库 migration 开始，禁止复制本机案例库：

```bash
npm run db:migrate:deploy
```

禁止对共享或正式库执行：

```bash
npx prisma db push --force-reset
npx prisma db seed
npm run db:seed:demo
```

当前关键索引包括：

- `Task(projectId, status, deadline)`：项目事项筛选和逾期判断。
- `ExecutionCalendarEntry(projectId, date)`：项目日历和全局月历。
- 项目活动、预算流水、来源证据、报告、分享链接均按项目和时间维度查询。

每天执行 `deploy/backup-postgres.sh` 生成压缩备份，至少保留一份在腾讯云 COS 私有桶中；每月恢复一次到临时容器，验证备份确实可用。

## 登录与成员策略

- 每位成员使用自己的邮箱和至少 12 位密码登录。
- 密码使用 `scrypt` 加盐哈希；数据库只存会话 token 的哈希。
- 会话有效期 7 天，退出登录立即撤销当前会话；停用账号时应一并撤销全部会话。
- 管控事项负责人是业务责任人，不等于登录账号，也不自动拥有编辑权限。
- `LEADER` 可查看全局，但不会自动获得非本人项目的编辑权；编辑由项目的 `EDITOR | VIEWER` 成员关系决定。

当前试运营用受控 CLI 初始化账号，避免在尚未成熟的团队后台中堆入一套半成品权限 UI。

创建首位管理员：

```bash
TEAM_ADMIN_NAME='姓名' \
TEAM_ADMIN_EMAIL='name@company.com' \
TEAM_ADMIN_PASSWORD='至少12位强密码' \
npm run team:bootstrap-admin
```

创建或重设成员账号：

```bash
TEAM_MEMBER_NAME='姓名' \
TEAM_MEMBER_EMAIL='name@company.com' \
TEAM_MEMBER_PASSWORD='至少12位强密码' \
TEAM_MEMBER_ROLE='MEMBER' \
npm run team:create-member
```

同邮箱再次执行会更新姓名、角色、密码并恢复账号。`LEADER` 仅授予真正需要全局管理权限的人。

## 每次更新

1. 在本机先通过 `npm test`、`npm run lint`、`npm run build`。
2. 数据库变化必须新增 migration；不要在正式库使用 `db push`。
3. 先确认自动备份成功，显式构建最新 `migrator` 镜像，再运行 `npm run db:migrate:deploy`。应用镜像和迁移镜像是不同 Docker target，不能只更新应用镜像。
4. 更新镜像并重启 ShadowPM 容器。
5. 冒烟：管理员登录、普通成员登录、工作空间、一个项目详情、资金账本、执行月历、AI 导入、退出登录、`/api/health`。
6. 回归时仅回滚应用镜像；已执行的数据库 migration 用新的前向修复 migration 处理，不对真实数据做盲目回滚。

生产环境的实际命令以 [TENCENT_CVM_DEPLOYMENT.md](./TENCENT_CVM_DEPLOYMENT.md) 的“以后更新”段落为准，其中包含 `build migrator`。

## 试运营首周

- 每天检查 `https://<域名>/api/health`、容器日志和数据库备份结果。
- 观察 AI 是否清晰拆开管控事项、预算流水与执行日历。
- 记录真实编辑阻塞、权限误解、预算流转不一致和月历排期遗漏。
- 第一周只修复阻断登录、数据完整性、权限、创建/编辑和 AI 导入可信度的问题，不扩展新模块。
