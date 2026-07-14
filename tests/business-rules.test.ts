import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../src/generated/prisma/client";
import { calculateBudgetSnapshot } from "../src/lib/budget";
import { getBudgetSignal } from "../src/lib/budget-signals";
import { buildAIImportPlan } from "../src/lib/ai-import-plan";
import { shouldCreateConfirmedBudgetFlow } from "../src/lib/ai-import-rules";
import { canReadProject, canWriteProject } from "../src/lib/permission-rules";
import { buildWeeklyHealthSummary } from "../src/lib/weekly-health-summary";
import { isCommandCenterWriteRequest, isProjectHealthQuery, isProjectListQuery } from "../src/lib/command-center-query";
import { buildCalendarFeed, isValidShareToken, normalizeShareExpiryDays } from "../src/lib/p2-rules";
import { getWorkspaceHealth } from "../src/lib/workspace-health";
import { getProjectLifecycle } from "../src/lib/project-lifecycle";
import { hashPassword, validatePassword, verifyPassword } from "../src/lib/password";

describe("budget business rules", () => {
  it("treats BudgetFlow allocation as the financial source of truth", () => {
    const snapshot = calculateBudgetSnapshot({
      plannedBudget: new Prisma.Decimal(5000000),
      allocated: new Prisma.Decimal(1200000),
      expense: new Prisma.Decimal(-300000),
      refund: new Prisma.Decimal(50000),
    });

    assert.equal(snapshot.plannedBudget.toNumber(), 5000000);
    assert.equal(snapshot.allocated.toNumber(), 1200000);
    assert.equal(snapshot.expense.toNumber(), 300000);
    assert.equal(snapshot.refund.toNumber(), 50000);
    assert.equal(snapshot.consumed.toNumber(), 250000);
    assert.equal(snapshot.balance.toNumber(), 950000);
    assert.equal(snapshot.usagePercent, 21);
  });

  it("does not double-count planned budget as available budget", () => {
    const snapshot = calculateBudgetSnapshot({
      plannedBudget: 5000000,
      allocated: 0,
      expense: 0,
      refund: 0,
    });

    assert.equal(snapshot.allocated.toNumber(), 0);
    assert.equal(snapshot.balance.toNumber(), 0);
    assert.equal(snapshot.usagePercent, 0);
    assert.equal(snapshot.plannedVariance.toNumber(), -5000000);
  });

  it("keeps refunds from making consumed budget negative", () => {
    const snapshot = calculateBudgetSnapshot({
      plannedBudget: 100000,
      allocated: 100000,
      expense: -20000,
      refund: 50000,
    });

    assert.equal(snapshot.consumed.toNumber(), 0);
    assert.equal(snapshot.balance.toNumber(), 100000);
  });

  it("keeps budget reductions and expenses from double-counting planned budget", () => {
    const snapshot = calculateBudgetSnapshot({
      plannedBudget: 500000,
      allocated: 300000,
      expense: -120000,
      refund: 20000,
    });

    assert.equal(snapshot.plannedBudget.toNumber(), 500000);
    assert.equal(snapshot.allocated.toNumber(), 300000);
    assert.equal(snapshot.consumed.toNumber(), 100000);
    assert.equal(snapshot.balance.toNumber(), 200000);
    assert.equal(snapshot.plannedVariance.toNumber(), -200000);
    assert.equal(snapshot.usagePercent, 33);
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
  it("does not turn estimates or low-confidence budget signals into confirmed allocations", () => {
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
  });

  it("allows only approved or explicit allocation budget signals into the ledger", () => {
    assert.equal(shouldCreateConfirmedBudgetFlow({
      amount: 200000,
      type: "ALLOCATE",
      status: "APPROVED",
      confidence: "medium",
    }), true);

    assert.equal(shouldCreateConfirmedBudgetFlow({
      amount: 200000,
      type: "REFUND",
      status: "SETTLED",
      confidence: "high",
    }), false);
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
    assert.equal(plan.deferredBudgetCandidateCount, 1);
    assert.equal(plan.calendarNeedsConfirmationCount, 1);
  });

  it("blocks only missing project name or missing control table rows", () => {
    const plan = buildAIImportPlan({
      projectName: "",
      totalBudget: 100000,
      startDate: "2026-07-01",
      endDate: "2026-08-01",
      tasks: [],
      budgetItems: [],
      calendarEntries: [],
      createBudgetFlow: true,
    });

    assert.equal(plan.canCreateNow, false);
    assert.deepEqual(plan.requiredGaps, ["项目名称", "至少一条管控事项"]);
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
      createBudgetFlow: true,
    });

    assert.equal(plan.canCreateNow, true);
    // One project-level pool confirmation plus one safe item allocation.
    assert.equal(plan.confirmedBudgetFlowCount, 2);
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
