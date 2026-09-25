import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { followersOf, followingOf, installMockApi, mockEvents, resetMockFeed, resetMockFollows, userPostsFor } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

/** Анна wrote one of the seeded wall posts; Пётр wrote none, so his grid is the empty state. */
const POSTING_FRIEND_ID = "a0000000-0000-4000-8000-0000000000b1";

const SILENT_FRIEND_ID = "a0000000-0000-4000-8000-0000000000b4";

describe("the post grid of экран 36", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockFeed();
  });

  it("opens on the posts the demo account already published", () => {
    const posts = userPostsFor(DEMO_USER_ID);

    expect(posts).toHaveLength(7);
    expect(posts.map((post) => post.category)).toContain("volunteering");
    expect(posts.map((post) => post.category)).toContain("tourism");
  });

  it("gives every tile the cover it is drawn with: the event title and its category", () => {
    const tile = userPostsFor(DEMO_USER_ID).at(-1)!;

    expect(tile.eventId).toBe(mockEvents[0].id);
    expect(tile.eventTitle).toBe(mockEvents[0].title);
    expect(tile.category).toBe(mockEvents[0].category);
    expect(tile.photoUrl).toBeNull();
  });

  it("leaves the grid of someone who published nothing empty rather than borrowing the seed", () => {
    expect(userPostsFor(SILENT_FRIEND_ID)).toEqual([]);
  });

  it("builds the grid of a friend out of their own posts, not the demo seed", () => {
    const posts = userPostsFor(POSTING_FRIEND_ID);

    expect(posts).toHaveLength(1);
    expect(posts[0].eventTitle).toBe(mockEvents[1].title);
  });

  it("puts a freshly published post on top of the grid, its own photo included", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    await api.createFeedPost({ userId: DEMO_USER_ID, eventId: mockEvents[5].id, text: "Трибуны гудели до последней минуты", photoUrl: "data:image/svg+xml;utf8,<svg/>" });
    const posts = await api.listUserPosts(DEMO_USER_ID);

    expect(posts).toHaveLength(8);
    expect(posts[0].eventId).toBe(mockEvents[5].id);
    expect(posts[0].photoUrl).toBe("data:image/svg+xml;utf8,<svg/>");
  });
});

describe("the two follow directions of экран 36", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockFollows();
  });

  it("answers with the three people the onboarding step left followed", () => {
    expect(followingOf(DEMO_USER_ID).map((person) => person.name)).toEqual(["Анна Соколова", "Дима Кузнецов", "Катя Орлова"]);
  });

  it("counts followers the viewer never chose: the direction is not the mirror of the follows", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const followers = await api.listFollowers(DEMO_USER_ID);

    expect(followers.length).toBeGreaterThan(followingOf(DEMO_USER_ID).length);
    expect(followers.map((person) => person.id)).not.toEqual(followingOf(DEMO_USER_ID).map((person) => person.id));
  });

  it("gives another person their own follow counters, not the demo account's", () => {
    expect(followingOf(POSTING_FRIEND_ID).some((person) => person.id === POSTING_FRIEND_ID)).toBe(false);
    expect(followersOf(POSTING_FRIEND_ID).length).toBeGreaterThan(0);
    expect(followingOf(POSTING_FRIEND_ID)).not.toEqual(followingOf(DEMO_USER_ID));
  });

  it("drops a person from the follows the moment the viewer unfollows them", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const [, ...rest] = followingOf(DEMO_USER_ID);

    await api.followFriends(rest.map((person) => person.id));

    expect((await api.listFollowing(DEMO_USER_ID)).map((person) => person.name)).toEqual(["Дима Кузнецов", "Катя Орлова"]);
  });
});
