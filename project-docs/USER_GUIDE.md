# ShadowPM Alpha User Guide

This guide is for non-developer reviewers who will test ShadowPM through a shared website.

The goal of the test is not to prove that every field is perfect. The goal is to see whether ShadowPM can turn a messy project spreadsheet into a useful project control workspace faster than manual Excel cleanup.

## 1. What ShadowPM Is

ShadowPM is an AI Native Project Management Platform.

It is designed to help internal teams:

- Upload or paste messy project information
- Generate a project control table
- Separate budget, execution calendar, and risks from messy source rows
- Review AI candidates before they become official records
- Keep progress and budget changes traceable

ShadowPM is not a task board. Please evaluate whether it makes project control faster and clearer.

## 2. Test Account

Use the test login cards on the `/login` page.

Recommended reviewer account:

- `陈鹏` for leader/global dashboard review
- `林小夏` for project creation and project control testing

If the site redirects you back to login, log in again. Session cookies are signed and may reset after deployment updates.

## 3. Recommended Test File

Use the sample workbook:

`project-docs/review-assets/one-million-project-control-sample.xlsx`

This file is intentionally messy and should not be treated as the ideal template.

Known source problems:

- Budget-like information may be mixed into project control rows
- Calendar cells may mix owner, channel, and content
- Some fields are incomplete
- Some rows are ambiguous

Expected ShadowPM behavior:

- Do not blindly copy the source structure
- Create a usable project control table
- Keep budget candidates in the review queue
- Keep calendar candidates in the review queue
- Keep risk/open-issue candidates in the review queue
- Allow missing budget or missing owners to be completed later

## 4. Full Test Flow

### Step 1: Log In

1. Open the test site.
2. Choose `林小夏`.
3. You should land on the AI workspace.

### Step 2: Start AI Project Creation

1. Click `新建项目`.
2. Keep the `AI 生成` tab selected.
3. Upload the sample workbook.
4. Click `开始解析`.

Expected result:

- AI analyzes the workbook.
- A preview or clarification screen appears.
- If the budget is missing or uncertain, it should not block creation.

### Step 3: Review The AI Preview

Check:

- Project name
- Project dates
- Project control table rows
- Workstreams/modules
- Owners
- Departments
- Deadlines
- Budget candidates
- Calendar candidates
- Risk candidates

Important:

- Budget, calendar, and risk candidates should not be automatically written into official records.
- Budget candidates should not default to `支出` unless AI clearly identified an expense.
- `预算池待确认` is acceptable. It means the project can be created first.

### Step 4: Create The Project

Click `创建项目与管控表`.

Expected result:

- The project detail page opens.
- The project control table exists.
- If no confirmed budget was entered, no initial `ALLOCATE` budget flow is created.
- AI import candidates appear in the review queue.

### Step 5: Review The Project Control Table

Open the `任务总控` tab.

Check:

- Are the main project control items understandable?
- Are workstreams separated from item names?
- Are owner and department fields placed in the right columns?
- Are missing fields visible enough?
- Is the table easier to work with than the original spreadsheet?

### Step 6: Review Budget Candidates

Look at the `AI 导入审核队列`.

For budget candidates:

1. Pick a candidate.
2. Select the related control item.
3. Choose `分配`, `支出`, or `退款`.
4. Confirm only if the candidate is meaningful.

Expected result:

- `ESTIMATE`, `TRANSFER`, or unclear budget candidates require manual flow type selection.
- Confirmed candidates become official budget flows.
- The budget ledger updates after refresh.

### Step 7: Review Calendar Candidates

Confirm a calendar candidate only if it looks useful.

Check:

- Date
- Channel
- Workstream
- Content
- Owner

Expected result:

- Confirmed calendar candidates appear in `执行日历`.
- Channel and owner should not be merged when AI can separate them.

### Step 8: Review Risk Candidates

Confirm risk/open-issue candidates only if they are real project risks.

Expected result:

- Confirmed risks appear in `风险/待定`.
- Risks should not be mixed into the control table as ordinary tasks by default.

### Step 9: Test Copilot Queries

Try questions such as:

- `这个项目预算还有多少`
- `有哪些未关闭风险`
- `接下来有哪些执行日历`
- `哪些事项缺负责人`

Expected result:

- Copilot should answer from official project data.
- It should not invent missing budget, owners, or dates.

### Step 10: Submit In-App Feedback

On the project detail page, use the `外测反馈` panel.

Please submit:

- Overall rating
- AI extraction quality
- Upload/create outcome
- Whether you would keep using the product
- Budget/calendar/owner/missing-info issues
- The step that felt confusing or risky

Leader users can review all submitted feedback in `/feedback`.

## 5. What Feedback To Provide

Please submit feedback inside the app first. Use `project-docs/FEEDBACK_TEMPLATE.md` only when you need a longer written review.

Useful feedback examples:

- AI put budget into the control table instead of budget candidates
- AI treated an estimate as an expense
- AI mixed channel and owner in calendar entries
- Important rows were missing from the control table
- Too many low-value rows were created
- The preview was hard to understand
- The next action was unclear
- The UI used task-manager language instead of project-control language

## 6. Known Alpha Limitations

Current known gaps:

- Field-level confidence is not fully implemented yet
- Control table inline editing is still limited
- Execution calendar V2 is not complete
- Feedback collection is structured but still lightweight
- Business-rule tests need expansion
- Team/member permission model is still lightweight

Please do not judge the product as a finished SaaS product. Judge whether the core workflow is promising and where it breaks.
