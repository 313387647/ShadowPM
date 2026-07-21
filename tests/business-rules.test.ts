import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateBudgetPlanningSnapshot,
  canConfirmBudgetItem,
  getBudgetItemRemaining,
  getTaskDeletionBudgetEffect,
  mapLegacyTaskBudgetStatus,
  normalizeBudgetItemTaskIds,
  requiresBudgetChangeReason,
} from "../src/lib/budget-rules";
import { getBudgetSignal } from "../src/lib/budget-signals";
import { buildAIImportPlan } from "../src/lib/ai-import-plan";
import { requiresTotalBudgetConfirmation, resolveAIBudgetTaskId, shouldCreateConfirmedBudgetFlow, shouldDefaultSelectAIBudgetItem } from "../src/lib/ai-import-rules";
import { canReadProject, canWriteProject } from "../src/lib/permission-rules";
import { buildWeeklyHealthSummary } from "../src/lib/weekly-health-summary";
import { isCommandCenterWriteRequest, isProjectHealthQuery, isProjectListQuery } from "../src/lib/command-center-query";
import { buildCalendarFeed, isValidShareToken, normalizeShareExpiryDays } from "../src/lib/p2-rules";
import { getWorkspaceHealth } from "../src/lib/workspace-health";
import { getProjectLifecycle } from "../src/lib/project-lifecycle";
import { hashPassword, validatePassword, verifyPassword } from "../src/lib/password";
import { parseBudgetPaste } from "../src/lib/budget-import";
import { getProjectBudgetSummary } from "../src/lib/budget-summary";
import { hasExactTaskOrder, moveTaskInList } from "../src/lib/task-order";

describe("control-item ordering", () => {
  it("keeps a manual order independent from task status or other display fields", () => {
    const tasks = [
      { id: "brief", status: "COMPLETED" },
      { id: "launch", status: "IN_PROGRESS" },
      { id: "review", status: "PENDING" },
    ];

    assert.deepEqual(moveTaskInList(tasks, "review", "brief").map((task) => task.id), ["review", "brief", "launch"]);
  });

  it("rejects stale, duplicated, or cross-project order payloads", () => {
    assert.equal(hasExactTaskOrder(["a", "b", "c"], ["c", "a", "b"]), true);
    assert.equal(hasExactTaskOrder(["a", "b", "c"], ["a", "a", "b"]), false);
    assert.equal(hasExactTaskOrder(["a", "b", "c"], ["a", "b", "outside"]), false);
  });
});

describe("budget business rules", () => {
  it("parses a lightweight tabular budget paste without requiring tasks", () => {
    const result = parseBudgetPaste("媒体投放\t1500000\n内容制作  800000\n发布会执行\t活动\t1200000");

    assert.deepEqual(result.items, [
      { title: "媒体投放", plannedAmount: 1500000, category: null },
      { title: "内容制作", plannedAmount: 800000, category: null },
      { title: "发布会执行", plannedAmount: 1200000, category: "活动" },
    ]);
    assert.deepEqual(result.invalidLines, []);
  });

  it("flags malformed pasted budget rows before they reach the database", () => {
    const result = parseBudgetPaste("正确项目\t1200\n没有金额\n错误金额\t-20");

    assert.equal(result.items.length, 1);
    assert.deepEqual(result.invalidLines, [2, 3]);
  });

  it("does not confirm an item before the project total budget is confirmed", () => {
    const result = canConfirmBudgetItem({
      budgetMode: "PENDING",
      totalBudget: 100000,
      otherActivePlannedAmount: 0,
      proposedPlannedAmount: 10000,
    });

    assert.equal(result.allowed, false);
  });

  it("does not allow planned budget items to exceed the project budget pool", () => {
    const result = canConfirmBudgetItem({
      budgetMode: "CONFIRMED",
      totalBudget: 100000,
      otherActivePlannedAmount: 80000,
      proposedPlannedAmount: 30000,
    });

    assert.equal(result.allowed, false);
    assert.match(result.message ?? "", /超出项目总预算/);
  });

  it("allows a draft budget item without any task relation", () => {
    assert.deepEqual(normalizeBudgetItemTaskIds([]), []);
  });

  it("releases allocation capacity when a budget item is cancelled", () => {
    const snapshot = calculateBudgetPlanningSnapshot({
      budgetMode: "CONFIRMED",
      totalBudget: 100000,
      items: [
        { plannedAmount: 60000, status: "CONFIRMED" },
        { plannedAmount: 20000, status: "CANCELED" },
      ],
      flows: [],
    });

    assert.equal(snapshot.planned.toNumber(), 60000);
    assert.equal(snapshot.remainingToAllocate.toNumber(), 40000);
  });

  it("does not let recorded expenses increase allocation capacity", () => {
    const snapshot = calculateBudgetPlanningSnapshot({
      budgetMode: "CONFIRMED",
      totalBudget: 100000,
      items: [{ plannedAmount: 80000, status: "CONFIRMED" }],
      flows: [{ action: "EXPENSE_RECORDED", amount: 20000 }],
    });

    assert.equal(snapshot.remainingToAllocate.toNumber(), 20000);
    assert.equal(snapshot.actualSpend.toNumber(), 20000);
  });

  it("correctly accounts for refunds in actual spend and item remaining", () => {
    const flows = [
      { action: "EXPENSE_RECORDED", amount: 45000 },
      { action: "REFUND_RECORDED", amount: 12000 },
    ];
    const snapshot = calculateBudgetPlanningSnapshot({
      budgetMode: "CONFIRMED",
      totalBudget: 100000,
      items: [{ plannedAmount: 60000, status: "CONFIRMED" }],
      flows,
    });

    assert.equal(snapshot.actualSpend.toNumber(), 33000);
    assert.equal(getBudgetItemRemaining(60000, flows).toNumber(), 27000);
  });

  it("uses the same independent budget summary across every product surface", () => {
    const summary = getProjectBudgetSummary({
      budgetMode: "CONFIRMED",
      totalBudget: 100000,
      budgetItems: [{ plannedAmount: 80000, status: "CONFIRMED" }],
      budgetFlows: [{ action: "EXPENSE_RECORDED", amount: 30000 }, { action: "REFUND_RECORDED", amount: 5000 }],
    });

    assert.equal(summary.planned, 80000);
    assert.equal(summary.actualSpend, 25000);
    assert.equal(summary.remainingToAllocate, 20000);
    assert.equal(summary.spendRemaining, 75000);
  });

  it("requires an audit reason only after an item leaves draft", () => {
    assert.equal(requiresBudgetChangeReason({ previousStatus: "DRAFT", nextStatus: "DRAFT", amountChanged: true }), false);
    assert.equal(requiresBudgetChangeReason({ previousStatus: "CONFIRMED", nextStatus: "CONFIRMED", amountChanged: true }), true);
    assert.equal(requiresBudgetChangeReason({ previousStatus: "CONFIRMED", nextStatus: "PENDING", amountChanged: false, isProjectPool: true, poolWasConfirmed: true }), true);
  });

  it("maps legacy task budget states without losing their financial lifecycle", () => {
    assert.equal(mapLegacyTaskBudgetStatus("ALLOCATED"), "CONFIRMED");
    assert.equal(mapLegacyTaskBudgetStatus("DISBURSED"), "IN_PROGRESS");
    assert.equal(mapLegacyTaskBudgetStatus("ACCEPTED"), "SETTLED");
  });

  it("keeps a budget item when its optional linked task is deleted", () => {
    assert.deepEqual(getTaskDeletionBudgetEffect(), { deleteBudgetItem: false, deleteTaskRelation: true });
  });

  it("flags a reduced pool that falls below active planned items", () => {
    const snapshot = calculateBudgetPlanningSnapshot({
      budgetMode: "CONFIRMED",
      totalBudget: 70000,
      items: [{ plannedAmount: 80000, status: "CONFIRMED" }],
      flows: [],
    });

    assert.equal(snapshot.overPlanned, true);
  });

  it("flags spending without a confirmed budget as high risk before a planned-budget reminder", () => {
    const signal = getBudgetSignal({
      plannedBudget: 500000,
      allocatedBudget: 0,
      balance: -120000,
      used: 120000,
      usagePercent: 0,
      flowCount: 1,
    });

    assert.equal(signal.level, "HIGH");
    assert.equal(signal.title, "存在支出但缺少确认预算");
  });

  it("keeps planned budget distinct from confirmed budget", () => {
    const signal = getBudgetSignal({
      plannedBudget: 500000,
      allocatedBudget: 0,
      balance: 0,
      used: 0,
      usagePercent: 0,
      flowCount: 0,
    });

    assert.equal(signal.level, "MEDIUM");
    assert.equal(signal.title, "计划预算尚未确认");
  });
});

describe("AI import safety rules", () => {
  it("never turns AI budget signals into confirmed financial allocations", () => {
    assert.equal(shouldCreateConfirmedBudgetFlow({
      amount: 200000,
      type: "ESTIMATE",
      status: "DRAFT",
      confidence: "high",
    }), false);

    assert.equal(shouldCreateConfirmedBudgetFlow({
      amount: 200000,
      type: "ALLOCATE",
      status: "APPROVED",
      confidence: "low",
    }), false);

    assert.equal(shouldCreateConfirmedBudgetFlow({
      amount: 200000,
      type: "ALLOCATE",
      status: "APPROVED",
      confidence: "high",
    }), false);
  });

  it("selects only high-confidence, conflict-free items for draft creation", () => {
    assert.equal(shouldDefaultSelectAIBudgetItem({
      amount: 200000,
      type: "ALLOCATE",
      status: "APPROVED",
      confidence: "high",
    }), true);

    assert.equal(shouldDefaultSelectAIBudgetItem({
      amount: 200000,
      type: "REFUND",
      status: "SETTLED",
      confidence: "medium",
    }), false);
  });

  it("does not bind an unmatched AI budget item to the first task", () => {
    const taskId = resolveAIBudgetTaskId({
      title: "海外媒体采购",
      tasks: [{ id: "first-task", name: "发布会执行", workstream: "活动" }],
    });
    assert.equal(taskId, null);
  });

  it("requires an explicit choice when AI finds multiple total-budget candidates", () => {
    assert.equal(requiresTotalBudgetConfirmation([100000, 120000], 100000), true);
  });
});

describe("AI import confirmation plan", () => {
  it("allows create-now flow when only optional fields are missing", () => {
    const plan = buildAIImportPlan({
      projectName: "U7海外整合营销",
      totalBudget: null,
      startDate: null,
      endDate: null,
      tasks: [
        {
          name: "公关传播排期确认",
          assignee: null,
          department: null,
          deadline: null,
          confidence: "medium",
        },
      ],
      budgetItems: [
        {
          title: "投放预算估算",
          amount: 200000,
          type: "ESTIMATE",
          status: "DRAFT",
          confidence: "high",
        },
      ],
      calendarEntries: [
        {
          content: "海外发布预热",
          date: null,
          owner: null,
          confidence: "medium",
        },
      ],
    });

    assert.equal(plan.canCreateNow, true);
    assert.deepEqual(plan.requiredGaps, []);
    assert.equal(plan.confirmedBudgetFlowCount, 0);
    assert.equal(plan.selectedBudgetItemCount, 1);
    assert.equal(plan.deferredBudgetCandidateCount, 0);
    assert.equal(plan.calendarNeedsConfirmationCount, 1);
  });

  it("blocks only missing project identity; a control table may be added later", () => {
    const plan = buildAIImportPlan({
      projectName: "",
      totalBudget: 100000,
      startDate: "2026-07-01",
      endDate: "2026-08-01",
      tasks: [],
      budgetItems: [],
      calendarEntries: [],
      budgetMode: "PENDING",
    });

    assert.equal(plan.canCreateNow, false);
    assert.deepEqual(plan.requiredGaps, ["项目名称"]);
  });

  it("allows a budget-pending project without a synthetic control item", () => {
    const plan = buildAIImportPlan({
      projectName: "预算待确认项目",
      totalBudget: null,
      startDate: null,
      endDate: null,
      tasks: [],
      budgetItems: [],
      calendarEntries: [],
      budgetMode: "PENDING",
    });

    assert.equal(plan.canCreateNow, true);
  });

  it("blocks confirmed AI budget items that exceed the user-confirmed pool", () => {
    const plan = buildAIImportPlan({
      projectName: "海外发布项目",
      totalBudget: 100000,
      startDate: null,
      endDate: null,
      tasks: [],
      budgetItems: [
        { title: "媒体投放", amount: 80000, confidence: "high", selected: true },
        { title: "内容制作", amount: 50000, confidence: "high", selected: true },
      ],
      calendarEntries: [],
      budgetMode: "CONFIRMED",
    });

    assert.equal(plan.canCreateNow, false);
    assert.ok(plan.requiredGaps.includes("预算项合计不能超过项目总预算"));
  });

  it("explains confirmed writes before AI-created projects are persisted", () => {
    const plan = buildAIImportPlan({
      projectName: "一万台整合营销",
      totalBudget: 5000000,
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      tasks: [{ name: "整合营销总控", assignee: "林小夏", department: "市场部", deadline: "2026-08-01" }],
      budgetItems: [
        {
          title: "媒体投放",
          amount: 1500000,
          type: "ALLOCATE",
          status: "APPROVED",
          confidence: "high",
        },
      ],
      calendarEntries: [{ content: "首轮传播上线", date: "2026-07-20", owner: "林小夏", confidence: "high" }],
      budgetMode: "CONFIRMED",
    });

    assert.equal(plan.canCreateNow, true);
    // AI evidence may create a project pool only after confirmation; its item
    // remains a draft rather than a confirmed financial allocation.
    assert.equal(plan.confirmedBudgetFlowCount, 1);
    assert.equal(plan.calendarEntryCount, 1);
    assert.equal(plan.rowsWithDiagnostics, 0);
  });
});

describe("project permission rules", () => {
  it("allows leaders to read every project but not edit projects they do not own", () => {
    assert.equal(canReadProject({
      userId: "leader-1",
      role: "LEADER",
      ownerId: "member-1",
    }), true);

    assert.equal(canWriteProject({
      userId: "leader-1",
      role: "LEADER",
      ownerId: "member-1",
    }), false);
  });

  it("keeps external tester projects outside the leader's default read scope", () => {
    assert.equal(canReadProject({
      userId: "leader-1",
      role: "LEADER",
      ownerId: "external-1",
      isExternalProject: true,
    }), false);
    assert.equal(canReadProject({
      userId: "external-1",
      role: "MEMBER",
      ownerId: "external-1",
      isExternalProject: true,
    }), true);
  });

  it("allows project owners to read and edit their own projects", () => {
    const params = {
      userId: "member-1",
      role: "MEMBER",
      ownerId: "member-1",
    };

    assert.equal(canReadProject(params), true);
    assert.equal(canWriteProject(params), true);
  });

  it("blocks regular members from reading or editing other people's projects", () => {
    const params = {
      userId: "member-1",
      role: "MEMBER",
      ownerId: "member-2",
    };

    assert.equal(canReadProject(params), false);
    assert.equal(canWriteProject(params), false);
  });

  it("allows explicit project editors to read and write without making assignee a permission source", () => {
    assert.equal(canReadProject({
      userId: "member-2",
      role: "MEMBER",
      ownerId: "member-1",
      memberRole: "EDITOR",
    }), true);

    assert.equal(canWriteProject({
      userId: "member-2",
      role: "MEMBER",
      ownerId: "member-1",
      memberRole: "EDITOR",
    }), true);
  });

  it("allows viewer collaborators to read but not write", () => {
    assert.equal(canReadProject({
      userId: "member-2",
      role: "MEMBER",
      ownerId: "member-1",
      memberRole: "VIEWER",
    }), true);

    assert.equal(canWriteProject({
      userId: "member-2",
      role: "MEMBER",
      ownerId: "member-1",
      memberRole: "VIEWER",
    }), false);
  });
});

describe("weekly health summary", () => {
  it("keeps dashboard health briefings available without a model call", () => {
    const summary = buildWeeklyHealthSummary({
      projectCount: 1,
      pending: 2,
      inProgress: 1,
      completed: 3,
      overdueCount: 1,
      missingOwnerCount: 1,
      plannedBudget: 100000,
      allocatedBudget: 80000,
      consumedBudget: 30000,
      projects: [{
        name: "U7海外整合营销",
        totalTasks: 6,
        completedTasks: 3,
        overdueTasks: 1,
        missingOwnerTasks: 1,
        upcomingCalendarEntries: 2,
        unscheduledCalendarEntries: 1,
      }],
    });

    assert.match(summary, /1 项已逾期/);
    assert.match(summary, /确认预算池 ¥80,000/);
    assert.match(summary, /U7海外整合营销 50%/);
  });
});

describe("workspace health rules", () => {
  it("prioritizes real risk signals over cosmetic progress", () => {
    assert.equal(getWorkspaceHealth({ overdueCount: 1, missingInfoCount: 0, budgetUsage: 10, budgetBalance: 90000, hasUnconfirmedSpend: false }), "RISK");
    assert.equal(getWorkspaceHealth({ overdueCount: 0, missingInfoCount: 1, budgetUsage: 20, budgetBalance: 90000, hasUnconfirmedSpend: false }), "WATCH");
    assert.equal(getWorkspaceHealth({ overdueCount: 0, missingInfoCount: 0, budgetUsage: 40, budgetBalance: 90000, hasUnconfirmedSpend: false }), "HEALTHY");
  });

  it("flags unconfirmed spending and negative balances as risk", () => {
    assert.equal(getWorkspaceHealth({ overdueCount: 0, missingInfoCount: 0, budgetUsage: 0, budgetBalance: -1, hasUnconfirmedSpend: false }), "RISK");
    assert.equal(getWorkspaceHealth({ overdueCount: 0, missingInfoCount: 0, budgetUsage: 0, budgetBalance: 0, hasUnconfirmedSpend: true }), "RISK");
  });
});

describe("project lifecycle rules", () => {
  const now = new Date("2026-07-13T00:00:00.000Z");

  it("derives completed projects from a fully completed control table", () => {
    assert.equal(getProjectLifecycle({ startDate: new Date("2026-07-01"), taskStatuses: ["COMPLETED", "COMPLETED"], now }), "COMPLETED");
  });

  it("keeps future projects pending until an item actually starts", () => {
    assert.equal(getProjectLifecycle({ startDate: new Date("2026-08-01"), taskStatuses: ["PENDING", "PENDING"], now }), "UPCOMING");
    assert.equal(getProjectLifecycle({ startDate: new Date("2026-08-01"), taskStatuses: ["IN_PROGRESS", "PENDING"], now }), "ACTIVE");
  });

  it("treats an unstarted project past its planned start as active attention", () => {
    assert.equal(getProjectLifecycle({ startDate: new Date("2026-07-01"), taskStatuses: ["PENDING"], now }), "ACTIVE");
  });
});

describe("Command Center query boundaries", () => {
  it("routes formal write requests back to the source table", () => {
    assert.equal(isCommandCenterWriteRequest("把发布会状态更新为完成"), true);
    assert.equal(isCommandCenterWriteRequest("U7海外整合营销预算还有多少"), false);
  });

  it("recognizes deterministic project lookup questions", () => {
    assert.equal(isProjectListQuery("现在有哪些项目"), true);
    assert.equal(isProjectHealthQuery("U7海外整合营销进度怎么样"), true);
  });
});

describe("P2 sharing and calendar rules", () => {
  it("caps public share expiry to a safe range", () => {
    assert.equal(normalizeShareExpiryDays(-2), 1);
    assert.equal(normalizeShareExpiryDays(30), 30);
    assert.equal(normalizeShareExpiryDays(365), 90);
  });

  it("accepts only generated base64url share tokens", () => {
    assert.equal(isValidShareToken("a".repeat(43)), true);
    assert.equal(isValidShareToken("short"), false);
    assert.equal(isValidShareToken(`${"a".repeat(42)}!`), false);
  });

  it("exports dated execution entries as a standards-based calendar feed", () => {
    const feed = buildCalendarFeed("上市项目", [{
      id: "calendar-1",
      date: new Date("2026-07-20T00:00:00.000Z"),
      startTime: "09:30",
      endTime: null,
      content: "媒体沟通会",
      workstream: "公关传播",
      channel: "线下",
      owner: "周予安",
      notes: null,
      status: "CONFIRMED",
    }], new Date("2026-07-10T00:00:00.000Z"));

    assert.match(feed, /BEGIN:VCALENDAR/);
    assert.match(feed, /DTSTART:20260720T093000/);
    assert.match(feed, /DTEND:20260720T103000/);
    assert.match(feed, /SUMMARY:媒体沟通会/);
  });
});

describe("team authentication rules", () => {
  it("hashes passwords without persisting their plaintext", async () => {
    const password = "ShadowPM-team-2026!";
    const hash = await hashPassword(password);

    assert.ok(hash.startsWith("scrypt$"));
    assert.equal(hash.includes(password), false);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword("incorrect-password", hash), false);
  });

  it("requires a usable team password", () => {
    assert.equal(validatePassword("short"), "密码至少需要 12 个字符");
    assert.equal(validatePassword("ShadowPM-team-2026!"), null);
  });
});
