import { beforeEach, describe, expect, it } from "vitest";
import { addMockPlanParticipant, addMockSharedCalendarPeer, joinMockSharedCalendarEntry, mockFriends, mockPlanTimeline, mockSharedCalendar, openMockPlanChat, planCards, resetMockPlans, resetMockSharedCalendar } from "./mock";

const UNKNOWN_ID = "90000000-0000-4000-8000-0000000000ff";

beforeEach(() => {
  resetMockPlans();
  resetMockSharedCalendar();
});

describe("mockPlanTimeline", () => {
  it("lays the evening out in order and closes it with the event of the plan", () => {
    const card = planCards()[0];
    const timeline = mockPlanTimeline(card.plan.id);
    if (timeline === null) throw new Error("the seeded plan must have a timeline");

    expect(timeline.steps.length).toBeGreaterThanOrEqual(2);
    expect(timeline.steps.map((step) => step.at)).toEqual([...timeline.steps.map((step) => step.at)].sort());
    expect(timeline.steps[timeline.steps.length - 1].eventId).toBe(card.event.id);
  });

  it("carries the ride as a transfer with a mode and a fare — the part #504 has no endpoint for", () => {
    const timeline = mockPlanTimeline(planCards()[0].plan.id);
    const ride = timeline?.steps.find((step) => step.transfer !== null);

    expect(ride?.transfer?.mode).toBe("taxi");
    expect(ride?.transfer?.minutes).toBeGreaterThan(0);
    expect(ride?.transfer?.priceRub).toBeGreaterThan(0);
  });

  it("marks the demo plan as assembled by MAX and answers null for a plan that does not exist", () => {
    expect(mockPlanTimeline(planCards()[0].plan.id)?.assembledByMax).toBe(true);
    expect(mockPlanTimeline(UNKNOWN_ID)).toBeNull();
  });
});

describe("openMockPlanChat", () => {
  it("issues a link for a plan that has none and leaves an existing one alone", () => {
    const withChat = planCards()[0];
    expect(openMockPlanChat(withChat.plan.id)?.plan.chatLink).toBe(withChat.plan.chatLink);

    const withoutChat = planCards()[1];
    expect(withoutChat.plan.chatLink).toBeNull();
    const opened = openMockPlanChat(withoutChat.plan.id);
    expect(opened?.plan.chatLink).toContain("https://max.ru/chat/");
  });

  it("drops the issued link on reset, so one test cannot seed the next", () => {
    const planId = planCards()[1].plan.id;
    openMockPlanChat(planId);
    resetMockPlans();

    expect(planCards()[1].plan.chatLink).toBeNull();
  });

  it("answers null for an unknown plan", () => {
    expect(openMockPlanChat(UNKNOWN_ID)).toBeNull();
  });
});

describe("addMockPlanParticipant", () => {
  it("adds a friend the plan did not have", () => {
    const planId = planCards()[1].plan.id;
    const before = planCards()[1].plan.participants.length;
    const card = addMockPlanParticipant(planId, mockFriends[6].id);
    if (card === "no_plan" || card === "invalid") throw new Error("the host must be allowed to invite a friend");

    expect(card.plan.participants).toHaveLength(before + 1);
    expect(card.plan.participants[card.plan.participants.length - 1].status).toBe("invited");
  });

  it("stays idempotent for someone already in the plan", () => {
    const card = planCards()[1];
    const again = addMockPlanParticipant(card.plan.id, card.plan.participants[0].friend.id);
    if (again === "no_plan" || again === "invalid") throw new Error("a repeated invite must not be an error");

    expect(again.plan.participants).toHaveLength(card.plan.participants.length);
  });

  it("refuses a stranger and an unknown plan, the way the backend does", () => {
    expect(addMockPlanParticipant(planCards()[0].plan.id, "a0000000-0000-4000-8000-0000000000ff")).toBe("invalid");
    expect(addMockPlanParticipant(UNKNOWN_ID, mockFriends[0].id)).toBe("no_plan");
  });
});

describe("mockSharedCalendar", () => {
  it("shares the calendar with Анна and lets her edit it", () => {
    const shared = mockSharedCalendar();

    expect(shared.peers).toHaveLength(1);
    expect(shared.peers[0].friend.id).toBe(mockFriends[0].id);
    expect(shared.peers[0].canEdit).toBe(true);
    expect(shared.inviteUrl).toContain("https://");
  });

  it("returns the records sorted by start, both-going ones included", () => {
    const shared = mockSharedCalendar();

    expect(shared.entries.map((row) => row.startsAt)).toEqual([...shared.entries.map((row) => row.startsAt)].sort());
    expect(shared.entries.some((row) => row.bothGoing)).toBe(true);
    expect(shared.entries.some((row) => row.needsResponse)).toBe(true);
  });
});

describe("joinMockSharedCalendarEntry", () => {
  it("turns «вы не отметились» into «оба идёте»", () => {
    const target = mockSharedCalendar().entries.find((row) => row.needsResponse);
    if (target === undefined) throw new Error("a record awaiting an answer is expected");
    const after = joinMockSharedCalendarEntry(target.id);
    const row = after?.entries.find((item) => item.id === target.id);

    expect(row?.bothGoing).toBe(true);
    expect(row?.needsResponse).toBe(false);
  });

  it("answers null for a record that does not exist", () => {
    expect(joinMockSharedCalendarEntry("97000000-0000-4000-8000-0000000000ff")).toBeNull();
  });

  it("forgets the answer on reset", () => {
    const target = mockSharedCalendar().entries.find((row) => row.needsResponse);
    if (target === undefined) throw new Error("a record awaiting an answer is expected");
    joinMockSharedCalendarEntry(target.id);
    resetMockSharedCalendar();

    expect(mockSharedCalendar().entries.find((row) => row.id === target.id)?.needsResponse).toBe(true);
  });
});

describe("addMockSharedCalendarPeer", () => {
  it("opens the calendar to one more friend, once", () => {
    addMockSharedCalendarPeer(mockFriends[1].id);
    const shared = addMockSharedCalendarPeer(mockFriends[1].id);

    expect(shared?.peers.filter((peer) => peer.friend.id === mockFriends[1].id)).toHaveLength(1);
    expect(shared?.peers).toHaveLength(2);
  });

  it("refuses someone who is not a friend", () => {
    expect(addMockSharedCalendarPeer("a0000000-0000-4000-8000-0000000000ff")).toBeNull();
  });
});
