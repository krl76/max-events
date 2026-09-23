import { afterEach, describe, expect, it } from "vitest";
import { ReportSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
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

  it("names what every queue row is about, and the author only where the object has one", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    createMockReport({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, reason: "spam" });
    createMockReport({ userId: DEMO_USER_ID, placeId: mockPlaces[0].id, reason: "spam" });

    const targets = await api.listModerationTargets();
    expect(targets.find((row) => row.targetId === mockEvents[0].id)).toMatchObject({ title: mockEvents[0].title, organizerId: mockOrganizers[0].id });
    // A place has no organizer behind it in the fixtures, so its card never offers a ban.
    expect(targets.find((row) => row.targetId === mockPlaces[0].id)).toMatchObject({ title: mockPlaces[0].title, organizerId: null });

    await api.unpublishTarget({ targetType: "event", targetId: mockEvents[0].id });
    // The разбор screen must still be able to name what it just took down, so a sanction does not blank the row.
    expect((await api.listModerationTargets()).find((row) => row.targetId === mockEvents[0].id)?.title).toBe(mockEvents[0].title);
  });

  it("keeps a moderator's own spot check out of the complaint stream", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const check = await api.createSpotCheck({ userId: DEMO_USER_ID, eventId: mockEvents[1].id, reason: "other" });
    expect(check.source).toBe("spot_check");
    expect((await api.listOpenReports()).filter((row) => row.source === "user")).toEqual([]);

    setMockModerator(false);
    await expect(api.createSpotCheck({ userId: DEMO_USER_ID, eventId: mockEvents[2].id, reason: "other" })).rejects.toMatchObject({ status: 403 });
    await expect(api.listModerationTargets()).rejects.toMatchObject({ status: 403 });
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
