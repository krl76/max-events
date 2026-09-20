import { afterEach, describe, expect, it } from "vitest";
import { PlanCardSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, mockFriends, mockPlans, planCard, planCards } from "./mock";

describe("plan fixtures", () => {
  it("pair every plan with a known event, known friends and a valid PlanCard", () => {
    const cards = planCards();

    expect(cards.map((card) => card.plan.id)).toEqual(mockPlans.map((card) => card.plan.id));
    expect(cards.every((card) => PlanCardSchema.safeParse(card).success)).toBe(true);
    expect(cards.every((card) => mockEvents.some((event) => event.id === card.event.id && event.id === card.plan.eventId))).toBe(true);
    expect(cards.every((card) => card.plan.participants.every((participant) => mockFriends.some((friend) => friend.id === participant.friend.id)))).toBe(true);
  });

  it("give the demo plan a chat link and leave the second plan without one", () => {
    const cards = planCards();

    expect(cards[0]?.plan.chatLink).toBe("https://max.ru/chat/mock-plan-1");
    expect(cards[1]?.plan.chatLink).toBeNull();
  });

  it("are sorted by the soonest meeting first", () => {
    const meetings = planCards().map((card) => card.plan.meetingAt);

    expect(meetings).toEqual([...meetings].sort());
  });

  it("cover invited, confirmed and declined participant statuses", () => {
    const statuses = planCards().flatMap((card) => card.plan.participants.map((participant) => participant.status));

    expect(statuses).toContain("invited");
    expect(statuses).toContain("confirmed");
    expect(statuses).toContain("declined");
  });
});

describe("planCard", () => {
  it("finds a card by plan id and returns null for an unknown id", () => {
    expect(planCard(mockPlans[0].plan.id)?.plan.id).toBe(mockPlans[0].plan.id);
    expect(planCard("90000000-0000-4000-8000-000000000099")).toBeNull();
  });
});

describe("plans mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("serve the plan list through the typed client", async () => {
    restore = installMockApi();

    const cards = await new ApiClient("/api").listPlans();

    expect(cards).toEqual(planCards());
  });

  it("tolerate the origin query the live client sends", async () => {
    restore = installMockApi();

    const cards = await new ApiClient("/api").listPlans({ latitude: 55.7522, longitude: 37.6156 });

    expect(cards).toEqual(planCards());
  });

  it("serve a single plan by id and return 404 for an unknown plan", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const loaded = await client.getPlan(mockPlans[0].plan.id);

    expect(loaded).toEqual(planCard(mockPlans[0].plan.id));
    await expect(client.getPlan("90000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ status: 404 });
  });
});
