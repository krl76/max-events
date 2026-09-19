import { afterEach, describe, expect, it } from "vitest";
import type { PlanBudget } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockBudgetFromExpenses, mockDemoUser, mockEvents, mockFriendIds, mockPlaces, mockPlans, resetMockWeGroups } from "./mock";

const DEMO_ID = mockDemoUser.id;
const SEED_GROUP_ID = "91000000-0000-4000-8000-000000000001";
const NOT_OWNED_GROUP_ID = "91000000-0000-4000-8000-000000000003";
const FOREIGN_GROUP_ID = "91000000-0000-4000-8000-000000000004";
const UNKNOWN_ID = "91000000-0000-4000-8000-000000000099";
const PLAN_ONE_ID = mockPlans[0].plan.id;
const PARTY_ONE = [DEMO_ID, mockFriendIds[0], mockFriendIds[1]];

function expectBudgetInvariants(budget: PlanBudget): void {
  expect(budget.perPerson.reduce((sum, person) => sum + person.shareRub, 0)).toBe(budget.totalRub);
  expect(budget.perPerson.reduce((sum, person) => sum + person.paidRub, 0)).toBe(budget.totalRub);
  expect(budget.perPerson.reduce((sum, person) => sum + person.netRub, 0)).toBe(0);
  const settled = new Map<string, number>();
  for (const debt of budget.debts) {
    settled.set(debt.fromUserId, (settled.get(debt.fromUserId) ?? 0) - debt.amountRub);
    settled.set(debt.toUserId, (settled.get(debt.toUserId) ?? 0) + debt.amountRub);
  }
  for (const person of budget.perPerson) {
    expect(settled.get(person.userId) ?? 0).toBe(person.netRub);
  }
}

describe("we-groups mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockWeGroups();
  });

  it("creates a group, lists it and serves its screen", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const created = await client.createWeGroup({ title: "Поездка в Казань", memberIds: [mockFriendIds[0], mockFriendIds[1]] });
    expect(created.group.title).toBe("Поездка в Казань");
    expect(created.members.map((member) => member.id)).toEqual([DEMO_ID, mockFriendIds[0], mockFriendIds[1]]);

    const list = await client.listWeGroups();
    expect(list.some((screen) => screen.group.id === created.group.id)).toBe(true);

    const loaded = await client.getWeGroup(created.group.id);
    expect(loaded.group.id).toBe(created.group.id);
  });

  it("rejects an empty title with 400 and an unknown member with 404", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.createWeGroup({ title: "   ", memberIds: [] })).rejects.toMatchObject({ status: 400 });
    await expect(client.createWeGroup({ title: "Группа", memberIds: [UNKNOWN_ID] })).rejects.toMatchObject({ status: 404 });
  });

  it("binds an event and a place idempotently and rejects unknown targets", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const event = mockEvents.find((item) => item.id !== mockEvents[2].id)!;
    const place = mockPlaces.find((item) => item.id !== mockPlaces[3].id)!;

    const withEvent = await client.addWeGroupEvent(SEED_GROUP_ID, event.id);
    expect(withEvent.events.some((item) => item.id === event.id)).toBe(true);
    const again = await client.addWeGroupEvent(SEED_GROUP_ID, event.id);
    expect(again.events.filter((item) => item.id === event.id)).toHaveLength(1);

    const withPlace = await client.addWeGroupPlace(SEED_GROUP_ID, place.id);
    expect(withPlace.places.some((item) => item.id === place.id)).toBe(true);

    await expect(client.addWeGroupEvent(SEED_GROUP_ID, UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
    await expect(client.addWeGroupPlace(SEED_GROUP_ID, UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("lets the owner archive, forbids a non-owner member and stays idempotent", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const archived = await client.archiveWeGroup(SEED_GROUP_ID);
    expect(archived.group.status).toBe("archived");
    expect(archived.group.archivedAt).not.toBeNull();
    const twice = await client.archiveWeGroup(SEED_GROUP_ID);
    expect(twice.group.status).toBe("archived");

    await expect(client.archiveWeGroup(NOT_OWNED_GROUP_ID)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects writes on an archived group with 409", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await client.archiveWeGroup(SEED_GROUP_ID);
    await expect(client.addWeGroupEvent(SEED_GROUP_ID, mockEvents[0].id)).rejects.toMatchObject({ status: 409 });
  });

  it("returns 404 for an unknown group and 403 for a group without the demo user", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.getWeGroup(UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
    await expect(client.getWeGroup(FOREIGN_GROUP_ID)).rejects.toMatchObject({ status: 403 });
  });

  it("keeps the foreign group out of the demo user's list", async () => {
    restore = installMockApi();
    const list = await new ApiClient("/api").listWeGroups();

    expect(list.some((screen) => screen.group.id === FOREIGN_GROUP_ID)).toBe(false);
    expect(list.some((screen) => screen.group.id === SEED_GROUP_ID)).toBe(true);
  });
});

describe("plan budget mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockWeGroups();
  });

  it("serves the seeded budget with the split/settle invariants", async () => {
    restore = installMockApi();
    const budget = await new ApiClient("/api").getPlanBudget(PLAN_ONE_ID);

    expect(budget.expenses).toHaveLength(2);
    expect(budget.totalRub).toBe(4600);
    expectBudgetInvariants(budget);
    expect(budget.debts.length).toBeGreaterThan(0);
  });

  it("adds an expense and recomputes totals and debts with the same invariants", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const before = await client.getPlanBudget(PLAN_ONE_ID);

    const after = await client.addPlanExpense(PLAN_ONE_ID, { title: "Такси", amountRub: 701, payerUserId: mockFriendIds[1], shareUserIds: PARTY_ONE });

    expect(after.totalRub).toBe(before.totalRub + 701);
    expect(after.expenses).toHaveLength(3);
    expectBudgetInvariants(after);
    const reloaded = await client.getPlanBudget(PLAN_ONE_ID);
    expect(reloaded.totalRub).toBe(after.totalRub);
  });

  it("rejects invalid payloads, a payer outside the party and an unknown plan", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.addPlanExpense(PLAN_ONE_ID, { title: "Х", amountRub: 0, payerUserId: DEMO_ID, shareUserIds: PARTY_ONE })).rejects.toMatchObject({ status: 400 });
    await expect(client.addPlanExpense(PLAN_ONE_ID, { title: "Х", amountRub: 10, payerUserId: DEMO_ID, shareUserIds: [] })).rejects.toMatchObject({ status: 400 });
    await expect(client.addPlanExpense(PLAN_ONE_ID, { title: "Х", amountRub: 10, payerUserId: mockFriendIds[2], shareUserIds: PARTY_ONE })).rejects.toMatchObject({ status: 400 });
    await expect(client.addPlanExpense(UNKNOWN_ID, { title: "Х", amountRub: 10, payerUserId: DEMO_ID, shareUserIds: [DEMO_ID] })).rejects.toMatchObject({ status: 404 });
    await expect(client.getPlanBudget(UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("splits the remainder by whole rubles (no kopecks, shares sum to the amount)", async () => {
    const budget = mockBudgetFromExpenses([{ id: "96000000-0000-4000-8000-000000000010", planId: PLAN_ONE_ID, title: "Тест", amountRub: 1000, payerUserId: DEMO_ID, shareUserIds: [...PARTY_ONE], createdAt: "2026-08-02T12:00:00+03:00" }]);

    const shares = budget.perPerson.map((person) => person.shareRub);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(1000);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    for (const share of shares) expect(Number.isInteger(share)).toBe(true);
  });
});
