# ShadowPM Canonical Project Schema

This document defines the target information architecture for ShadowPM projects.

It is the canonical contract for AI import, project creation, database design, UI previews, control-table editing, progress history, budget flow, and export.

Raw Excel, Word, PDF, or chat input may be incomplete, messy, denormalized, or structurally wrong. ShadowPM should not copy source structure blindly. AI must map source material into this canonical schema, preserve uncertainty, and expose missing information as editable gaps.

## Core Principle

A ShadowPM project is not a task list.

A project is a controlled operating system made of:

1. Project Profile
2. Project Control Table
3. Budget Ledger
4. Execution Calendar
5. Progress Change Log
6. Risk and Open Issues
7. Assets and References

The first four are user-facing work surfaces. The progress and budget logs are trust layers that make the system auditable.

## 1. Project Profile

Project Profile stores the stable high-level context.

Required fields:

- `name`: project name
- `owner`: primary project owner
- `startDate`: project start date, nullable when unknown
- `endDate`: project end date, nullable when unknown

Recommended fields:

- `objective`: what the project is trying to achieve
- `background`: business context
- `scope`: what is included and excluded
- `coreTeam`: key people and departments
- `totalBudgetPool`: approved or planned total budget pool
- `sourceConfidence`: AI confidence after import

AI import rules:

- Do not invent a project objective if the source only contains tasks.
- If project dates are unclear, leave them empty and mark as missing.
- If the source contains multiple possible project names, ask the user to confirm.
- If the source is a campaign, launch, event, PR, marketing, or operation plan, infer the category but keep it editable.

## 2. Project Control Table

The Project Control Table is the primary working artifact.

It answers:

- What needs to happen?
- Which workstream owns it?
- Who is responsible?
- What is the current status?
- What is blocked or missing?
- What is the latest conclusion?

Canonical fields:

- `workstream`: module, lane, work package, or execution line
- `item`: concrete control item, task, deliverable, decision, or milestone
- `description`: useful detail from source material
- `owner`: directly responsible person
- `department`: responsible department
- `deadline`: deadline or publish time
- `status`: `PENDING | IN_PROGRESS | COMPLETED | BLOCKED | CANCELLED`
- `priority`: `P0 | P1 | P2 | P3`
- `latestProgress`: latest progress or conclusion
- `riskLevel`: `LOW | MEDIUM | HIGH | CRITICAL`, nullable
- `blocker`: current blocker, nullable
- `relatedBudgetIds`: budget items or budget flows associated with this item
- `relatedCalendarIds`: execution calendar entries associated with this item
- `relatedAssetIds`: files, links, or documents associated with this item
- `missingFields`: derived list of fields that need user completion
- `sourceRowRef`: source file, sheet, row, or paragraph reference for audit
- `aiConfidence`: confidence for this row after AI import

Important modeling rules:

- Budget details do not belong inside `item`.
- Names and ownership should be separated. For example, `公关传播@汤庆爽` should become `workstream = 公关传播`, `owner = 汤庆爽`.
- If a source row contains `内容-267万`, split it into `item = 内容` and a budget candidate.
- A row such as `风险及待确定项` should not become a normal workstream without review. It should map to Risk and Open Issues unless the user confirms otherwise.
- Missing optional fields should not block draft creation.
- Missing essential fields should trigger AI clarification.

## 3. Budget Ledger

Budget is not a column hidden inside the control table. It is a ledger.

The Budget Ledger answers:

- What budget exists?
- What has been allocated?
- What has been spent?
- What has been refunded?
- What is pending approval?
- What is paused, cancelled, or uncertain?

Canonical budget item fields:

- `title`: budget item name
- `workstream`: associated workstream, nullable
- `controlItemId`: associated control table row, nullable
- `amount`: numeric amount in yuan
- `currency`: default `CNY`
- `type`: `ESTIMATE | ALLOCATE | EXPENSE | REFUND | TRANSFER`
- `status`: `DRAFT | PENDING_APPROVAL | APPROVED | IN_PROGRESS | SETTLED | PAUSED | CANCELLED`
- `description`: reason or notes
- `createdBy`: actor
- `createdAt`: timestamp
- `sourceRowRef`: source file, sheet, row, or paragraph reference
- `aiConfidence`: confidence after extraction

Budget flow rules:

- The durable financial truth is the append-only flow record, not a mutable balance field.
- Current balance should be computed from budget flows.
- Budget flow changes must be auditable.
- AI may extract budget candidates from text, but should not finalize them without enough confidence.
- If budget text is embedded in a task name, AI should separate text and amount.

Examples:

- Source: `央视频《以万为始》影片-267万`
- Control item candidate: `央视频《以万为始》影片`
- Budget candidate: `2670000`, type `ESTIMATE`, status `DRAFT`

## 4. Execution Calendar

Execution Calendar is optional but first-class for campaign, PR, marketing, event, launch, media, and operation projects.

It answers:

- What happens when?
- Through which channel or touchpoint?
- Which workstream owns it?
- Which control item does it support?

Canonical calendar fields:

- `date`: execution date
- `startTime`: nullable
- `endTime`: nullable
- `channel`: channel, platform, touchpoint, venue, or media outlet
- `workstream`: execution line or module
- `content`: what will be published, delivered, or executed
- `owner`: responsible person
- `department`: responsible department
- `status`: `PLANNED | READY | PUBLISHED | DONE | DELAYED | CANCELLED`
- `relatedControlItemId`: associated control row, nullable
- `notes`: execution notes
- `sourceCellRef`: source file, sheet, cell/range reference
- `aiConfidence`: confidence after extraction

Calendar import rules:

- Do not copy a messy calendar matrix as-is.
- If a source cell mixes channel, person, and content, split what can be split and mark low confidence.
- Channel and owner must be separate fields.
- Workstream and channel are different concepts.
- If extraction is uncertain, create a draft calendar entry with missing fields instead of inventing data.

## 5. Progress Change Log

Progress Change Log is an append-only record of project movement.

It answers:

- What changed?
- Who changed it?
- When did it change?
- Why did it change?
- Was it changed by a human or AI?

Canonical fields:

- `targetType`: `PROJECT | CONTROL_ITEM | BUDGET_ITEM | CALENDAR_ENTRY | RISK | ASSET`
- `targetId`: target record id
- `changeType`: `CREATE | UPDATE | STATUS_CHANGE | COMMENT | AI_ACTION | IMPORT | DELETE_REQUEST`
- `before`: structured snapshot of changed fields, nullable for create
- `after`: structured snapshot of changed fields, nullable for delete request
- `summary`: human-readable change summary
- `createdBy`: user or system actor
- `createdAt`: timestamp
- `source`: `HUMAN | AI | IMPORT | SYSTEM`
- `confidence`: AI confidence when source is AI or import

Rules:

- Status changes must always create a progress log.
- Important field changes in the control table should create progress logs.
- AI-generated updates must be labeled as AI actions.
- Logs should be append-only. Do not mutate old progress logs except for administrative correction with explicit audit.
- Deleting a control item with history should prefer archival or delete request over hard delete.

Examples:

- `状态变更：进行中 -> 已完成`
- `负责人变更：空 -> 林小夏`
- `AI 导入：从 Excel 第 41 行生成公关传播事项`

## 6. Budget Flow Log

Budget Flow Log is the financial audit layer.

It answers:

- Why did the balance change?
- Who recorded it?
- Which item or project does it belong to?

Canonical fields:

- `projectId`
- `budgetItemId`: nullable
- `controlItemId`: nullable
- `flowType`: `ALLOCATE | EXPENSE | REFUND | TRANSFER | ADJUSTMENT`
- `amount`: signed decimal amount
- `description`
- `createdBy`
- `createdAt`
- `approvalStatus`: nullable
- `source`: `HUMAN | AI | IMPORT | SYSTEM`
- `sourceRowRef`: nullable

Rules:

- Expenses are negative.
- Allocation, refund, and positive adjustment are positive.
- Balance is computed from flow sum.
- Budget Flow Log must never be replaced by a mutable remaining-budget field.
- AI can propose flows from source data, but user confirmation is required for high-impact financial mutations.

## 7. Risk and Open Issues

Risk and Open Issues are not ordinary tasks by default.

Canonical fields:

- `title`
- `description`
- `type`: `BUDGET | SCHEDULE | RESOURCE | SCOPE | APPROVAL | EXTERNAL | OTHER`
- `level`: `LOW | MEDIUM | HIGH | CRITICAL`
- `status`: `OPEN | ACKNOWLEDGED | MITIGATED | CLOSED`
- `owner`
- `relatedControlItemId`
- `relatedBudgetItemId`
- `relatedCalendarId`
- `suggestion`
- `sourceRowRef`

Import rules:

- Rows named `风险`, `待确定项`, `问题`, `阻塞`, `待确认`, or similar should be routed here first.
- If the user wants the risk managed as a task, link it to a control item instead of flattening it.

## 8. Assets and References

Assets support the project but should not become the primary project structure.

Canonical fields:

- `title`
- `type`: `DOCUMENT | LINK | FILE | NOTE`
- `folder`
- `content`
- `url`
- `version`
- `relatedControlItemId`
- `relatedCalendarId`
- `sourceRef`

## AI Import Pipeline

AI import must follow this pipeline:

1. Detect source document type and candidate sheets/sections.
2. Identify source structure and quality.
3. Map raw source into canonical modules.
4. Separate mixed fields, especially:
   - budget embedded in task names
   - owner embedded after `@`
   - channel mixed with owner in calendar cells
   - risks mixed into normal task rows
5. Mark confidence and source references.
6. Ask only for essential missing information.
7. Create a draft with visible gaps.
8. Let the user complete non-essential gaps in the control table, budget table, or calendar.

## Source Quality Labels

Every import should classify the source:

- `clean`: close to canonical structure
- `usable`: mostly structured with some missing fields
- `messy`: useful but mixed fields, merged cells, or unclear semantics
- `unsafe`: too ambiguous to auto-create without user confirmation

For messy sources, AI should produce a clear mapping summary:

- what became project profile
- what became control table rows
- what became budget candidates
- what became calendar entries
- what became risks
- what could not be confidently mapped

## Current Sample Workbook Assessment

The workbook `案例/副本-【一万台】项目管控表.xlsx` is a useful messy source, not a canonical template.

Observed issues:

- Budget items are written inside the project control table.
- Owner names are sometimes embedded in project/module names.
- The owner column is mostly empty.
- Calendar cells mix content, channel, people, and timing.
- Risk and open issues are mixed into the same sheet.
- Merged cells imply hierarchy but make machine extraction harder.

How ShadowPM should handle it:

- Use it as an AI extraction stress test.
- Do not copy its hierarchy directly into the product model.
- Normalize it into Project Profile, Control Table, Budget Ledger, Execution Calendar, Progress Log, Risk/Open Issues, and Assets.

## Implementation Implications

Near-term implementation should evolve toward:

- `Project`
- `Workstream`
- `ControlItem`
- `BudgetItem`
- `BudgetFlow`
- `CalendarEntry`
- `ProgressChangeLog`
- `Risk`
- `Asset`

The current `Task` model can temporarily represent `ControlItem`, but new code should use product language such as `control item`, `workstream`, and `project control table` in UI and AI prompts.

Avoid expanding the product around the word `task` unless it is a low-level implementation detail.
