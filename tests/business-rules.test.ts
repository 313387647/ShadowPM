import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../src/generated/prisma/client";
import { calculateBudgetSnapshot } from "../src/lib/budget";
import { shouldCreateConfirmedBudgetFlow } from "../src/lib/ai-import-rules";
import { canReadProject, canWriteProject } from "../src/lib/permission-rules";

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
});
