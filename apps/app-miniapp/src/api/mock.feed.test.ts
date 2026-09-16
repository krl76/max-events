import { afterEach, describe, expect, it } from "vitest";
import { FriendSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { feedPosts, installMockApi, mockEvents, resetMockFeed } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("feed fixtures", () => {
  afterEach(resetMockFeed);

  it("seed impression posts by friends on events, newest first", () => {
    const posts = feedPosts(null);

    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.every((post) => FriendSchema.safeParse(post.author).success)).toBe(true);
    expect(posts.every((post) => mockEvents.some((event) => event.id === post.eventId))).toBe(true);
    expect(posts[0].comments.length).toBeGreaterThan(0);
  });

  it("filter the posts of one event for the wall", () => {
    const eventId = mockEvents[1].id;

    expect(feedPosts(eventId).length).toBeGreaterThan(0);
    expect(feedPosts(eventId).every((post) => post.eventId === eventId)).toBe(true);
  });
});

describe("feed mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockFeed();
  });

  it("serve posts through the typed client", async () => {
    restore = installMockApi();

    expect(await new ApiClient("/api").listFeedPosts()).toEqual(feedPosts(null));
  });

  it("serve the wall of one event through the typed client", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const eventId = mockEvents[1].id;

    const wall = await client.listFeedPosts(eventId);

    expect(wall).toEqual(feedPosts(eventId));
    expect(wall.every((post) => post.eventId === eventId)).toBe(true);
  });

  it("toggle a like with the counter and back", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const post = (await client.listFeedPosts())[0];

    const liked = await client.toggleFeedLike(post.id, DEMO_USER_ID);
    expect(liked.likedByMe).toBe(true);
    expect(liked.likesCount).toBe(post.likesCount + 1);

    const unliked = await client.toggleFeedLike(post.id, DEMO_USER_ID);
    expect(unliked.likedByMe).toBe(false);
    expect(unliked.likesCount).toBe(post.likesCount);
  });

  it("append a comment attributed to its author", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const post = (await client.listFeedPosts())[0];

    const updated = await client.addFeedComment(post.id, { userId: DEMO_USER_ID, text: "Тоже иду!" });

    expect(updated.comments).toHaveLength(post.comments.length + 1);
    expect(updated.comments.at(-1)).toMatchObject({ text: "Тоже иду!", author: { id: DEMO_USER_ID } });
  });

  it("publish an impression post into the feed and the event wall", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const eventId = mockEvents[2].id;

    const created = await client.createFeedPost({ userId: DEMO_USER_ID, eventId, text: "Субботник — было здорово" });
    expect(created.author.id).toBe(DEMO_USER_ID);
    expect(created.likesCount).toBe(0);
    expect(created.comments).toEqual([]);

    const wall = await client.listFeedPosts(eventId);
    expect(wall.map((post) => post.id)).toContain(created.id);
    expect(wall[0].id).toBe(created.id);
  });

  it("reject unknown posts and events with 404 and empty payloads with 400", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const post = (await client.listFeedPosts())[0];

    await expect(client.toggleFeedLike("30000000-0000-4000-8000-000000000099", DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.addFeedComment("30000000-0000-4000-8000-000000000099", { userId: DEMO_USER_ID, text: "хм" })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.createFeedPost({ userId: DEMO_USER_ID, eventId: "00000000-0000-4000-8000-000000000000", text: "хм" })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.addFeedComment(post.id, { userId: DEMO_USER_ID, text: "  " })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client.toggleFeedLike(post.id, "")).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client.createFeedPost({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, text: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
