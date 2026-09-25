import { afterEach, describe, expect, it } from "vitest";
import { MicroEventSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { createMockMicroEvent, installMockApi, joinMockMicroEvent, leaveMockMicroEvent, microEventCard, microEvents, mockDemoUser, mockFriendIds, mockPlaces, resetMockMicroEvents } from "./mock";

const DEMO_USER_ID = mockDemoUser.id;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const STARTS_AT = "2026-09-19T15:00:00.000Z";

describe("micro-events mock", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockMicroEvents();
  });

  it("seeds open micro events that pass the contract, with both location kinds", () => {
    const events = microEvents();

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.every((item) => MicroEventSchema.safeParse(item).success)).toBe(true);
    expect(events.every((item) => item.status === "open")).toBe(true);
    expect(events.some((item) => item.locationText !== null && item.placeId === null)).toBe(true);
    expect(events.some((item) => item.placeId !== null && item.locationText === null)).toBe(true);
  });

  it("creates a micro event counting the author as the first participant", () => {
    const created = createMockMicroEvent({ userId: DEMO_USER_ID, title: "Играем в настолки", startsAt: STARTS_AT, locationText: "Антикафе на Тверской", participantsLimit: 4 });

    expect(created).toMatchObject({ authorId: DEMO_USER_ID, participantsCount: 1, participantsLimit: 4, status: "open" });
    expect(MicroEventSchema.safeParse(created).success).toBe(true);
    expect(microEvents().map((item) => item.title)).toContain("Играем в настолки");
  });

  it("accepts a known placeId and rejects an unknown one", () => {
    const created = createMockMicroEvent({ userId: DEMO_USER_ID, title: "Утренняя пробежка", startsAt: STARTS_AT, placeId: mockPlaces[0].id, participantsLimit: 2 });

    expect(created).toMatchObject({ placeId: mockPlaces[0].id, locationText: null });
    expect(createMockMicroEvent({ userId: DEMO_USER_ID, title: "Утренняя пробежка", startsAt: STARTS_AT, placeId: UNKNOWN_ID, participantsLimit: 2 })).toBe("no_place");
  });

  it("rejects drafts without an author, a title, a valid timestamp or a positive limit", () => {
    expect(createMockMicroEvent({ userId: "", title: "Читаем", startsAt: STARTS_AT, locationText: "Библиотека", participantsLimit: 2 })).toBe("invalid");
    expect(createMockMicroEvent({ userId: DEMO_USER_ID, title: "", startsAt: STARTS_AT, locationText: "Библиотека", participantsLimit: 2 })).toBe("invalid");
    expect(createMockMicroEvent({ userId: DEMO_USER_ID, title: "Читаем", startsAt: "завтра в обед", locationText: "Библиотека", participantsLimit: 2 })).toBe("invalid");
    expect(createMockMicroEvent({ userId: DEMO_USER_ID, title: "Читаем", startsAt: STARTS_AT, locationText: "Библиотека", participantsLimit: 0 })).toBe("invalid");
    expect(createMockMicroEvent({ userId: DEMO_USER_ID, title: "Читаем", startsAt: STARTS_AT, participantsLimit: 2 })).toBe("invalid");
  });

  it("moves the counter on join and leave, idempotently", () => {
    const target = microEvents()[0];
    const before = target.participantsCount;

    expect(joinMockMicroEvent(target.id, DEMO_USER_ID)).toMatchObject({ participantsCount: before + 1 });
    expect(joinMockMicroEvent(target.id, DEMO_USER_ID)).toMatchObject({ participantsCount: before + 1 });
    expect(leaveMockMicroEvent(target.id, DEMO_USER_ID)).toMatchObject({ participantsCount: before });
    expect(leaveMockMicroEvent(target.id, DEMO_USER_ID)).toMatchObject({ participantsCount: before });
    expect(joinMockMicroEvent(UNKNOWN_ID, DEMO_USER_ID)).toBeNull();
    expect(leaveMockMicroEvent(UNKNOWN_ID, DEMO_USER_ID)).toBeNull();
  });

  it("refuses to join a full micro event", () => {
    const created = createMockMicroEvent({ userId: DEMO_USER_ID, title: "Соло-обед", startsAt: STARTS_AT, locationText: "Депо. Москва", participantsLimit: 1 });
    if (typeof created === "string") throw new Error("solo fixture must be created");

    expect(joinMockMicroEvent(created.id, mockFriendIds[0])).toBe("full");
  });

  it("serves the list, creation and join/leave through the typed client", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const list = await api.listMicroEvents();
    expect(list.length).toBeGreaterThanOrEqual(2);

    const created = await api.createMicroEvent({ userId: DEMO_USER_ID, title: "Пляжный волейбол", startsAt: STARTS_AT, locationText: "Песок у Лужников", participantsLimit: 4 });
    expect(created.participantsCount).toBe(1);

    const joined = await api.joinMicroEvent(list[0].id, DEMO_USER_ID);
    expect(joined.participantsCount).toBe(list[0].participantsCount + 1);

    const left = await api.leaveMicroEvent(list[0].id, DEMO_USER_ID);
    expect(left.participantsCount).toBe(list[0].participantsCount);
  });

  it("maps unknown ids to 404 and invalid drafts to 400", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    await expect(api.joinMicroEvent(UNKNOWN_ID, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.leaveMicroEvent(UNKNOWN_ID, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.createMicroEvent({ userId: DEMO_USER_ID, title: "", startsAt: STARTS_AT, locationText: "Где-то", participantsLimit: 2 })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.createMicroEvent({ userId: DEMO_USER_ID, title: "Кино на крыше", startsAt: STARTS_AT, placeId: UNKNOWN_ID, participantsLimit: 2 })).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});

describe("micro-event card mock", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockMicroEvents();
  });

  it("resolves participantIds into names and marks the author, who leads the list", () => {
    const open = microEvents()[0];
    const card = microEventCard(open.id)!;

    expect(card.event.id).toBe(open.id);
    expect(card.participants).toHaveLength(open.participantIds.length);
    expect(card.participants[0]).toMatchObject({ author: true, friend: { id: open.authorId } });
    expect(card.participants.every((row) => row.friend.name.length > 0)).toBe(true);
    expect(card.participants.filter((row) => row.author)).toHaveLength(1);
  });

  it("carries the venue of a place-backed gathering and nothing for a typed address", () => {
    const withPlace = microEvents().find((item) => item.placeId !== null)!;
    const withText = microEvents().find((item) => item.locationText !== null)!;

    expect(microEventCard(withPlace.id)!.place!.id).toBe(withPlace.placeId);
    expect(microEventCard(withText.id)!.place).toBeNull();
  });

  it("serves a cancelled gathering too, because экран 25 has a state for it", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const cancelled = "20000000-0000-4000-8000-000000000004";

    expect((await api.getMicroEventCard(cancelled)).event.status).toBe("cancelled");
  });

  it("maps an unknown id to 404 and a broken uuid to 400", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    expect(microEventCard(UNKNOWN_ID)).toBeNull();
    await expect(api.getMicroEventCard(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.getMicroEventCard("not-a-uuid")).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
