import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../src/generated/prisma/client";
import { calculateBudgetSnapshot } from "../src/lib/budget";

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
      refund: 5000,
    });

    assert.equal(snapshot.consumed.toNumber(), 15000);
    assert.equal(snapshot.balance.toNumber(), 85000);
  });
});
