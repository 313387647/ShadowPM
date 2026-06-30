# ShadowPM Test Deployment Checklist

This checklist prepares ShadowPM for private reviewer testing through a shared website.

## 1. Deployment Goal

The immediate goal is not public launch.

The goal is a private Alpha test site where reviewers can:

1. Log in with a test user
2. Upload a project spreadsheet
3. Review AI extraction
4. Create a project control workspace
5. Edit the generated control table, budget ledger, and execution calendar
6. Submit structured feedback

Recommended share URL:

```text
https://<your-test-domain>/demo
```

## 2. Minimum Product Gate

Required before sharing the URL:

- [x] P0.1 permission hardening
- [x] P0.2 budget formula unification
- [x] P0.3 project creation without confirmed budget
- [x] P0.4 direct editable AI import without a separate review queue
- [x] P0.5 remove independent risk/assets surfaces from the Alpha core
- [ ] Shared deployment configured
- [ ] Database initialized
- [ ] Seed users available
- [ ] Sample spreadsheet smoke-tested
- [x] Feedback collection path prepared

## 3. Required Environment Variables

Configure these in the deployment environment:

```bash
DATABASE_URL=
SHADOWPM_SESSION_SECRET=
DEEPSEEK_API_KEY=
```

Notes:

- `SHADOWPM_SESSION_SECRET` is required for signed session cookies.
- `DEEPSEEK_API_KEY` is required for AI import and AI summaries.
- Do not commit `.env`.
- Production/shared deployment should not rely on the local development fallback secret.

## 4. Build Commands

Use:

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run build
npm run start
```

Quality gate:

```bash
npm test
npm run lint
npm run build
```

## 5. Smoke Test

Before sharing the URL, run this exact flow:

1. Open the deployed site.
2. Log in as `林小夏`.
3. Click `新建项目`.
4. Upload:

```text
project-docs/review-assets/one-million-project-control-sample.xlsx
```

5. Confirm AI preview appears.
6. Create the project even if budget is missing.
7. Confirm project detail page opens.
8. Check:
   - `任务总控`
   - `资金账本`
   - `执行日历`
   - `项目活动`
9. Submit the in-app `外测反馈` form on the project page.
10. Confirm a leader user can see the feedback in `/feedback`.
11. Confirm AI-generated budget rows and calendar rows can be edited after project creation.

## 6. Reviewer Instructions

Send reviewers:

- Test site URL
- Recommended login user
- `project-docs/BEGINNER_TUTORIAL.md`
- `project-docs/USER_GUIDE.md`
- The sample spreadsheet if they do not have repo access

Suggested message:

```text
请测试 ShadowPM Alpha：打开 Demo 链接，按照《ShadowPM 小白测试教程》上传案例表格，查看 AI 是否能生成可用的项目管控表，并重点反馈预算和执行日历是否被正确拆分。

请不要只评价页面是否好看，重点看：
1. 是否比原 Excel 更容易理解
2. AI 有没有把预算误当任务或支出
3. 日历有没有混淆渠道/负责人/内容
4. 哪些缺失信息应该直接在表格里补齐

创建项目后，请在项目页的「外测反馈」面板提交结构化反馈。
```

## 7. Data Reset During Testing

For repeated tests, prefer separate projects instead of deleting production-like records.

For local or disposable test DB only:

```bash
npx prisma db push --force-reset
npx prisma db seed
```

Do not run destructive reset commands against a shared database unless everyone agrees.
