import { afterEach, describe, expect, it } from "vitest";
import { PlanCardSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { cancelMockPlan, createMockPlan, installMockApi, mockEvents, mockFriendIds, mockFriends, mockPlans, planCard, planCards, resetMockPlans } from "./mock";

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

describe("mock plan creation and cancellation", () => {
  const eventId = mockEvents[0].id;

  afterEach(resetMockPlans);

  it("creates a one-off plan with the invited friends", () => {
    const created = createMockPlan({ eventId, participantIds: [mockFriendIds[0]], meetingPoint: "у метро", meetingAt: "2026-09-19T18:20:00+03:00" });

    if (created === "no_event") throw new Error("fixture event is missing");
    expect(PlanCardSchema.safeParse(created)).toMatchObject({ success: true });
    expect(created.plan.participants.map((row) => row.friend.id)).toEqual([mockFriendIds[0]]);
    // No rule, no series: one meeting, and nothing to cancel «as a series».
    expect(created.plan.recurringRule).toBeNull();
    expect(created.plan.seriesId).toBeNull();
    expect(createMockPlan({ eventId: "c0000000-0000-4000-8000-000000000000", participantIds: [], meetingPoint: "у метро", meetingAt: "2026-09-19T18:20:00+03:00" })).toBe("no_event");
  });

  it("spawns the nearest occurrences of a repeating plan, all on the chosen weekday", () => {
    const rule = { type: "weekly_weekday" as const, weekday: 4 };
    const before = planCards().length;

    const template = createMockPlan({ eventId, participantIds: [], meetingPoint: "у метро", meetingAt: "2026-09-17T18:20:00+03:00", recurringRule: rule });

    if (template === "no_event") throw new Error("fixture event is missing");
    const series = planCards().filter((row) => row.plan.seriesId === template.plan.id);
    expect(planCards().length).toBe(before + 5);
    expect(series).toHaveLength(5);
    // Every occurrence carries the rule, so the screen can say «каждый четверг» on any of them.
    expect(series.every((row) => row.plan.recurringRule?.type === "weekly_weekday")).toBe(true);
    expect(series.slice(1).every((row) => new Date(row.plan.meetingAt).getTime() > new Date(template.plan.meetingAt).getTime())).toBe(true);
  });

  it("cancels one meeting, or the whole series", () => {
    const rule = { type: "weekly_weekday" as const, weekday: 4 };
    const template = createMockPlan({ eventId, participantIds: [], meetingPoint: "у метро", meetingAt: "2026-09-17T18:20:00+03:00", recurringRule: rule });
    if (template === "no_event") throw new Error("fixture event is missing");
    const occurrence = planCards().find((row) => row.plan.seriesId === template.plan.id && row.plan.id !== template.plan.id)!;

    expect(cancelMockPlan(occurrence.plan.id, "occurrence")).toBe("ok");
    expect(planCards().map((row) => row.plan.id)).not.toContain(occurrence.plan.id);
    // The rest of the series survives one cancelled meeting.
    expect(planCards().filter((row) => row.plan.seriesId === template.plan.id)).toHaveLength(4);

    expect(cancelMockPlan(template.plan.id, "series")).toBe("ok");
    expect(planCards().filter((row) => row.plan.seriesId === template.plan.id)).toHaveLength(0);
    expect(cancelMockPlan(template.plan.id, "occurrence")).toBe("no_plan");
  });
});
