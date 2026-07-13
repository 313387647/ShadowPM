# ShadowPM Alpha User Guide

This guide is for non-developer reviewers who will test ShadowPM through a shared website.

The goal of the test is not to prove that every field is perfect. The goal is to see whether ShadowPM can turn a messy project spreadsheet into a useful project control workspace faster than manual Excel cleanup.

## 1. What ShadowPM Is

ShadowPM is an AI Native Project Management Platform.

It is designed to help internal teams:

- Upload or paste messy project information
- Generate a project control table
- Separate budget and execution calendar from messy source rows
- Directly edit the generated control table, budget ledger, and execution calendar
- Keep progress and budget changes traceable

ShadowPM is not a task board. Please evaluate whether it makes project control faster and clearer.

## 2. Test Account

Use the login cards on the `/login` page.

Recommended reviewer account:

- `陈鹏` for leader/global dashboard review
- `周予安` for project creation and project control testing
- `许闻澜` for collaborator and read-only permission testing

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
- Write identifiable budget rows into the budget ledger
- Write identifiable calendar rows into the execution calendar
- Keep blockers, open questions, and uncertain information in editable table notes or activity summaries
- Allow missing budget or missing owners to be completed later

## 4. Full Test Flow

### Step 1: Log In

1. Open the test site.
2. Choose `周予安`.
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
- Watch items or uncertain information in editable notes

Important:

- Budget and calendar rows should become official editable records when AI can identify them.
- Budget candidates should not default to `支出` unless AI clearly identified an expense.
- `预算池待确认` is acceptable. It means the project can be created first.

### Step 4: Create The Project

Click `创建项目与管控表`.

Expected result:

- The project detail page opens.
- The project control table exists.
- If no confirmed budget was entered, no initial `ALLOCATE` budget flow is created.
- AI-generated budget rows and calendar rows appear in their official editable modules.

### Step 5: Review The Project Control Table

Open the `管控总表` tab.

Check:

- Are the main project control items understandable?
- Are workstreams separated from item names?
- Are owner and department fields placed in the right columns?
- Are missing fields visible enough?
- Is the table easier to work with than the original spreadsheet?

### Step 6: Review Budget And Calendar

Open the project detail page after creation.

Check:

1. `资金账本`: AI-generated budget rows should be visible and editable through normal budget operations.
2. `执行日历`: AI-generated calendar rows should show date, channel, owner, content, and status.
3. `项目活动`: creation and later edits should leave traceable records.
4. Missing or uncertain fields should be fixed directly in the table.

Expected result:

- `ESTIMATE`, `TRANSFER`, or unclear budget candidates require manual flow type selection.
- Confirmed candidates become official budget flows.
- The budget ledger updates after refresh.

### Step 7: Review Execution Calendar

Check:

- Date
- Channel
- Workstream
- Content
- Owner

Expected result:

- AI-generated calendar rows appear in `执行日历`.
- Channel and owner should not be merged when AI can separate them.

### Step 8: Review Uncertain Information

Check whether uncertain or incomplete information stays editable instead of becoming a separate risk module.

Expected result:

- Blockers and open questions appear in control-table notes, activity summaries, or missing fields.
- They should be easy to fix directly in the project table.

### Step 9: Test Copilot Queries

Try questions such as:

- `这个项目预算还有多少`
- `有哪些事项逾期或待确认`
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

### Step 11: Export, Report, And Share

On the project page, click `输出与分享`.

You can:

- Download a canonical Excel workbook containing project profile, control table, progress changes, budget flows, execution calendar, activity, and source metadata.
- Generate a weekly or monthly report. Reports use official project data and retained upload evidence, then become traceable project activity.
- Create a 30-day read-only external project link.
- Copy an ICS subscription URL for Apple Calendar, Google Calendar, Outlook, or other compatible calendar clients.
- Revoke an active external link immediately.

Important:

- Read-only project links do not allow editing.
- The calendar feed projects formal execution-calendar entries only. It does not create events from every active control item.
- The same share capability protects the read-only page and calendar feed, so revoking it disables both.
- Import evidence is used for grounding and source traceability; ShadowPM does not restore a separate asset center.

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

## 6. Current Boundaries

Current boundaries:

- Calendar sync is a read-only ICS subscription; two-way Google/Microsoft write-back is not included.
- Share links are project-level read-only capabilities, not guest accounts with comments.
- Import evidence stores bounded extracted text, not the original binary file.
- Reports can fall back to deterministic official-data summaries if the model is unavailable.
- Enterprise SSO, tenant isolation, managed object storage, queues, and backup automation remain later deployment work.

Please do not judge the product as a finished SaaS product. Judge whether the core workflow is promising and where it breaks.
