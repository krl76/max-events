import { afterEach, describe, expect, it } from "vitest";
import { GatheringSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { createMockGathering, friendAvailability, installMockApi, MOCK_GATHERING_ID, mockDemoUser, mockEvents, mockFriendIds, mockFriends, resetMockGatherings, respondMockGathering } from "./mock";

const MEETING_AT = "2026-09-19T18:00:00.000Z";

describe("friend availability fixtures", () => {
  it("covers every mock friend with a closed-set availability value", () => {
    const entries = friendAvailability();

    expect(entries.map((entry) => entry.friend.id)).toEqual(mockFriendIds);
    expect(entries.every((entry) => ["free", "busy", "unknown"].includes(entry.availability))).toBe(true);
    expect(entries.map((entry) => entry.availability)).toContain("free");
    expect(entries.map((entry) => entry.availability)).toContain("unknown");
  });
});

describe("createMockGathering", () => {
  afterEach(() => {
    resetMockGatherings();
  });

  it("creates an awaiting gathering with deterministic per-fixture responses", () => {
    const gathering = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[1], mockFriendIds[2], mockFriendIds[3]], proposedMeetingAt: MEETING_AT });

    expect(gathering).not.toBeNull();
    expect(GatheringSchema.safeParse(gathering)).toMatchObject({ success: true });
    expect(gathering!.event.id).toBe(mockEvents[0].id);
    expect(gathering!.status).toBe("awaiting_responses");
    expect(gathering!.invitees.map((invitee) => invitee.friend.name)).toEqual(["Дима Кузнецов", "Катя Орлова", "Пётр Новиков"]);
    expect(gathering!.invitees.map((invitee) => invitee.response)).toEqual(["accepted", "considering", "busy"]);
    expect(gathering!.proposedMeetingAt).toBe(MEETING_AT);
  });

  it("rejects unknown events, unknown friends, empty invite lists and invalid timestamps", () => {
    expect(createMockGathering({ eventId: "c0000000-0000-4000-8000-000000000000", friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT })).toBeNull();
    expect(createMockGathering({ eventId: mockEvents[0].id, friendIds: ["a0000000-0000-4000-8000-0000000000ff"], proposedMeetingAt: MEETING_AT })).toBeNull();
    expect(createMockGathering({ eventId: mockEvents[0].id, friendIds: [], proposedMeetingAt: MEETING_AT })).toBeNull();
    expect(createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: "завтра вечером" })).toBeNull();
  });

  it("resetMockGatherings clears the in-memory store and id sequence", () => {
    const first = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT });
    resetMockGatherings();
    const second = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT });

    expect(second!.id).toBe(first!.id);
  });
});

describe("respondMockGathering", () => {
  afterEach(() => {
    resetMockGatherings();
  });

  it("writes the demo user's answer without touching the other invitees", () => {
    const answered = respondMockGathering(MOCK_GATHERING_ID, "accepted");
    if (typeof answered === "string") throw new Error("expected the seeded gathering to accept the demo answer");

    expect(GatheringSchema.safeParse(answered)).toMatchObject({ success: true });
    expect(answered.invitees.find((invitee) => invitee.friend.id === mockDemoUser.id)?.response).toBe("accepted");
    expect(answered.invitees.find((invitee) => invitee.friend.id === mockFriendIds[1])?.response).toBe("accepted");
  });

  it("rejects unknown gatherings and the host with backend parity", () => {
    expect(respondMockGathering("d0000000-0000-4000-8000-000000000099", "accepted")).toBe("unknown");
    const created = createMockGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT });
    expect(respondMockGathering(created!.id, "busy")).toBe("forbidden");
  });
});

describe("gathering mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockGatherings();
  });

  it("serves friend availability through the typed client", async () => {
    restore = installMockApi();

    const entries = await new ApiClient("/api").getFriendAvailability(mockEvents[0].id);

    expect(entries).toEqual(friendAvailability());
  });

  it("answers 400 for friend availability without an eventId", async () => {
    restore = installMockApi();

    await expect(new ApiClient("/api").getFriendAvailability("")).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("creates a gathering via POST and reads it back via the typed client", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const created = await client.createGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[1], mockFriendIds[2]], proposedMeetingAt: MEETING_AT });
    const loaded = await client.getGathering(created.id);

    expect(loaded).toEqual(created);
    expect(loaded.invitees).toHaveLength(2);
    expect(loaded.invitees.every((invitee) => mockFriends.some((friend) => friend.id === invitee.friend.id))).toBe(true);
  });

  it("returns 404 for an unknown gathering and rejects invalid launches", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.getGathering("d0000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ status: 404 });
    await expect(client.createGathering({ eventId: "c0000000-0000-4000-8000-000000000000", friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT })).rejects.toMatchObject({ status: 404 });
    await expect(client.createGathering({ eventId: mockEvents[0].id, friendIds: ["not-a-friend"], proposedMeetingAt: MEETING_AT })).rejects.toMatchObject({ status: 400 });
    await expect(client.createGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: "2026-09-19 18:00" })).rejects.toMatchObject({ status: 400 });
  });

  it("serves the seeded demo gathering and answers the demo user's PATCH through the typed client", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const seeded = await client.getGathering(MOCK_GATHERING_ID);
    expect(seeded.invitees.find((invitee) => invitee.friend.id === mockDemoUser.id)?.response).toBe("considering");

    const answered = await client.respondToGathering(MOCK_GATHERING_ID, "accepted");
    expect(answered.invitees.find((invitee) => invitee.friend.id === mockDemoUser.id)?.response).toBe("accepted");
    expect(await client.getGathering(MOCK_GATHERING_ID)).toEqual(answered);

    resetMockGatherings();
    const restored = await client.getGathering(MOCK_GATHERING_ID);
    expect(restored.invitees.find((invitee) => invitee.friend.id === mockDemoUser.id)?.response).toBe("considering");
  });

  it("returns 403 when the demo user is the host and 404 for an unknown gathering on PATCH response", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const created = await client.createGathering({ eventId: mockEvents[0].id, friendIds: [mockFriendIds[0]], proposedMeetingAt: MEETING_AT });
    await expect(client.respondToGathering(created.id, "accepted")).rejects.toMatchObject({ status: 403 });
    await expect(client.respondToGathering("d0000000-0000-4000-8000-000000000099", "accepted")).rejects.toMatchObject({ status: 404 });
  });
});
