import { afterEach, describe, expect, it } from "vitest";
import { ReportSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { reportOrganizers } from "../moderation/ModerationPage";
import { bannedMockOrganizers, createMockReport, installMockApi, mockEvents, mockOrganizers, mockPlaces, resetMockReports, setMockModerator } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const UNKNOWN_ID = "99999999-0000-4000-8000-000000000999";

describe("mock moderation queue", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockReports();
  });

  it("serves the open reports to a moderator and closes one", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const seeded = createMockReport({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, reason: "spam" });

    const open = await api.listOpenReports();
    expect(open.map((row) => row.id)).toEqual([(seeded as { id: string }).id]);
    expect(open.every((row) => ReportSchema.safeParse(row).success)).toBe(true);

    expect((await api.resolveReport(open[0].id)).status).toBe("resolved");
    // A closed report leaves the queue: that is the whole point of closing it.
    expect(await api.listOpenReports()).toEqual([]);
    await expect(api.resolveReport(UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("hides the queue from everyone outside MODERATOR_MAX_USER_IDS", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    setMockModerator(false);

    await expect(api.listOpenReports()).rejects.toMatchObject({ status: 403 });
    await expect(api.resolveReport(UNKNOWN_ID)).rejects.toMatchObject({ status: 403 });
    await expect(api.unpublishTarget({ targetType: "event", targetId: mockEvents[0].id })).rejects.toMatchObject({ status: 403 });
    await expect(api.banOrganizer(mockOrganizers[0].id)).rejects.toMatchObject({ status: 403 });
  });

  it("unpublishes the reported object and bans the organizer behind it", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    await api.unpublishTarget({ targetType: "event", targetId: mockEvents[0].id });
    await api.unpublishTarget({ targetType: "place", targetId: mockPlaces[0].id });
    // Unpublished means gone from what the mock serves, the way the backend drops published = false.
    expect((await api.listEvents()).map((row) => row.id)).not.toContain(mockEvents[0].id);
    await expect(api.getEvent(mockEvents[0].id)).rejects.toMatchObject({ status: 404 });
    await expect(api.getPlace(mockPlaces[0].id)).rejects.toMatchObject({ status: 404 });

    await api.banOrganizer(mockOrganizers[0].id);
    expect(bannedMockOrganizers()).toEqual([mockOrganizers[0].id]);

    await expect(api.unpublishTarget({ targetType: "event", targetId: UNKNOWN_ID })).rejects.toMatchObject({ status: 404 });
    await expect(api.banOrganizer(UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("resolves the organizer behind an event report, and only while the event is still published", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const onEvent = createMockReport({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, reason: "spam" }) as { id: string };
    const onPlace = createMockReport({ userId: DEMO_USER_ID, placeId: mockPlaces[0].id, reason: "spam" }) as { id: string };

    const before = await reportOrganizers(await api.listOpenReports(), DEMO_USER_ID);
    expect(before[onEvent.id]).toBe(mockOrganizers[0].id);
    // A place report has no event to read an organizer from, so it never offers a ban.
    expect(before[onPlace.id]).toBeUndefined();

    await api.unpublishTarget({ targetType: "event", targetId: mockEvents[0].id });
    // The reason the lookup happens up front: afterwards the event answers 404 like any hidden one.
    expect(await reportOrganizers(await api.listOpenReports(), DEMO_USER_ID)).toEqual({});
  });

  it("hides a reported feed post and micro-event, and puts every fixture back once the sanctions are reset", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const post = (await api.listFeedPosts())[0];
    const micro = (await api.listMicroEvents())[0];

    await api.unpublishTarget({ targetType: "event", targetId: mockEvents[0].id });
    await api.unpublishTarget({ targetType: "feed_post", targetId: post.id });
    await api.unpublishTarget({ targetType: "micro_event", targetId: micro.id });
    expect((await api.listFeedPosts()).map((row) => row.id)).not.toContain(post.id);
    expect((await api.listMicroEvents()).map((row) => row.id)).not.toContain(micro.id);
    await expect(api.unpublishTarget({ targetType: "micro_event", targetId: micro.id })).rejects.toMatchObject({ status: 404 });

    // The reset is what the next test file relies on: fixtures moderation removed come back seeded.
    resetMockReports();
    expect((await api.listEvents()).map((row) => row.id)).toContain(mockEvents[0].id);
    expect((await api.listFeedPosts()).map((row) => row.id)).toContain(post.id);
    expect((await api.listMicroEvents()).map((row) => row.id)).toContain(micro.id);
  });
});
