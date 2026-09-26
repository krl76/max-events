import { afterEach, describe, expect, it } from "vitest";
import { FriendSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { feedPosts, installMockApi, mockEvents, mockFeedPostExtras, mockFriends, mockPlaces, mockPostDrafts, mockStoryCompositions, resetMockFeed, resetMockParticipations } from "./mock";

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

  it("loads one post by id", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const post = (await client.listFeedPosts())[0];
    expect(await client.getFeedPost(post.id)).toEqual(post);
    await expect(client.getFeedPost("00000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({ status: 404 });
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

  it("keep the photo of a published post and hand it back on the wall", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const eventId = mockEvents[2].id;
    const photoUrl = `data:image/jpeg;base64,${"A".repeat(200)}`;

    const created = await client.createFeedPost({ userId: DEMO_USER_ID, eventId, text: "С фото", photoUrl });

    expect(created.photoUrl).toBe(photoUrl);
    expect((await client.listFeedPosts(eventId))[0].photoUrl).toBe(photoUrl);
    // A post without a photo still parses, and the card falls back to the category placeholder.
    expect((await client.createFeedPost({ userId: DEMO_USER_ID, eventId, text: "Без фото" })).photoUrl).toBeNull();
  });

  it("serve the wall of one place, not just one event", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const seeded = (await client.listFeedPosts()).map((post) => ({ post, event: mockEvents.find((item) => item.id === post.eventId) })).find((row) => row.event?.placeId != null);
    expect(seeded).toBeDefined();
    const placeId = seeded!.event!.placeId!;

    const wall = await client.listFeedPosts(undefined, placeId);

    // The place wall is the posts of that place's events; a post from another place must not leak in.
    const placeEventIds = new Set(mockEvents.filter((event) => event.placeId === placeId).map((event) => event.id));
    expect(wall.map((post) => post.id)).toContain(seeded!.post.id);
    expect(wall.every((post) => post.eventId !== null && placeEventIds.has(post.eventId))).toBe(true);
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

describe("home feed cards", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockFeed();
    resetMockParticipations();
  });

  it("serve the friend cards around one venue card, in the order of the design", async () => {
    restore = installMockApi();

    const cards = await new ApiClient("/api").listFeedCards(DEMO_USER_ID);

    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards[0].kind).toBe("friend");
    expect(cards[1].kind).toBe("place");
    expect(cards.filter((card) => card.kind === "place")).toHaveLength(1);
  });

  it("keep a card id equal to its post id, so likes and comments still hit /feed/:id", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const card = (await client.listFeedCards(DEMO_USER_ID)).find((item) => item.kind === "friend");
    expect(card).toBeDefined();

    const liked = await client.toggleFeedLike(card!.id, DEMO_USER_ID);

    expect(liked.likedByMe).toBe(true);
    expect(feedPosts(null).some((post) => post.id === card!.id)).toBe(true);
  });

  it("carry the mocked distance, counters and badges the list DTO has no field for yet (#496)", async () => {
    restore = installMockApi();

    const cards = await new ApiClient("/api").listFeedCards(DEMO_USER_ID);
    const friends = cards.flatMap((card) => (card.kind === "friend" ? [card] : []));

    expect(friends.some((card) => card.distanceKm !== null)).toBe(true);
    expect(friends.some((card) => card.live)).toBe(true);
    expect(friends.some((card) => card.hit)).toBe(true);
    expect(friends.some((card) => card.counts.waitlist !== null)).toBe(true);
    expect(friends.some((card) => card.counts.freeSeats !== null)).toBe(true);
  });

  it("reflect «Пойду» in the own status and in the counter", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const before = (await client.listFeedCards(DEMO_USER_ID)).flatMap((card) => (card.kind === "friend" && card.counts.going !== null ? [card] : []))[0];
    expect(before).toBeDefined();

    if (before === undefined || before.event === null) throw new Error("expected a friend card with an event");
    await client.setParticipationStatus(before.event.id, DEMO_USER_ID, "going");
    const after = (await client.listFeedCards(DEMO_USER_ID)).flatMap((card) => (card.kind === "friend" && card.id === before.id ? [card] : []))[0];

    expect(after.myStatus).toBe("going");
    expect(after.counts.going).toBe((before.counts.going ?? 0) + 1);
  });

  it("carry the venue offer the slot domain will own (#492) and the viewer status on it", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const venue = (await client.listFeedCards(DEMO_USER_ID)).flatMap((card) => (card.kind === "place" ? [card] : []))[0];

    expect(venue.pricePerHourRub).not.toBeNull();
    expect(venue.slotLabel).not.toBeNull();
    expect(venue.rating).not.toBeNull();
    expect(venue.myStatus).toBeNull();

    await client.setPlaceParticipationStatus(venue.place.id, DEMO_USER_ID, "going");
    const going = (await client.listFeedCards(DEMO_USER_ID)).flatMap((card) => (card.kind === "place" ? [card] : []))[0];
    expect(going.myStatus).toBe("going");

    await client.setPlaceParticipationStatus(venue.place.id, DEMO_USER_ID, null);
    const cleared = (await client.listFeedCards(DEMO_USER_ID)).flatMap((card) => (card.kind === "place" ? [card] : []))[0];
    expect(cleared.myStatus).toBeNull();
  });

  it("reject a venue status on an unknown place with 404 and without a viewer with 400", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.setPlaceParticipationStatus("b0000009-0000-4000-8000-000000000009", DEMO_USER_ID, "going")).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.setPlaceParticipationStatus(mockPlaces[0].id, "", "going")).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});

describe("publication payloads of the composers (#502)", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockFeed();
  });

  const client = () => new ApiClient("/api");

  it("keeps the caption, the place sticker, the poll and the audience the story table cannot hold", async () => {
    restore = installMockApi();
    const composition = { text: "Мангал в Горьком. Кто с нами?", sticker: { eventId: mockEvents[0].id, title: "Мангальная зона", subtitle: "Парк Горького · 14:00", seatsLeft: 4 }, poll: { question: "Во сколько удобнее?", options: ["14:00", "17:00"], answer: 0 }, audience: "close-friends" as const };

    const story = await client().createStory("data:image/svg+xml;utf8,<svg/>", composition);

    expect(story.imageUrl).toContain("data:image/svg+xml");
    expect(mockStoryCompositions).toEqual([composition]);
  });

  it("still publishes a bare story, the way the stories rail does", async () => {
    restore = installMockApi();

    await client().createStory("data:image/svg+xml;utf8,<svg/>");

    expect(mockStoryCompositions).toEqual([]);
  });

  it("refuses a half-built composition with 400 instead of publishing it silently stripped", async () => {
    restore = installMockApi();

    await expect(client().createStory("data:image/svg+xml;utf8,<svg/>", { text: "Мангал", sticker: { eventId: mockEvents[0].id, title: "Мангальная зона", subtitle: "Парк Горького · 14:00", seatsLeft: "четыре" } as never, poll: null, audience: "close-friends" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    expect(mockStoryCompositions).toEqual([]);
  });

  it("keeps the place, the tagged friends, the audience and the join switch beside the published post", async () => {
    restore = installMockApi();

    const post = await client().createFeedPost({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, text: "Собираемся в субботу", photoUrl: null, photoUrls: [], placeId: mockPlaces[0].id, taggedFriendIds: [mockFriends[0].id, mockFriends[1].id], audience: "company", allowJoin: true });

    expect(mockFeedPostExtras.get(post.id)).toEqual({ photoUrls: [], placeId: mockPlaces[0].id, taggedFriendIds: [mockFriends[0].id, mockFriends[1].id], audience: "company", allowJoin: true });
  });

  it("stores the autosaved draft and answers when it was saved", async () => {
    restore = installMockApi();
    const draft = { userId: DEMO_USER_ID, eventId: null, text: "Собираемся", photoUrls: [], placeId: null, taggedFriendIds: [], audience: "friends" as const, allowJoin: false };

    const receipt = await client().savePostDraft(draft);

    expect(Number.isNaN(Date.parse(receipt.savedAt))).toBe(false);
    expect(mockPostDrafts.get(DEMO_USER_ID)).toEqual(draft);
  });

  it("refuses a draft without an author with 400, since drafts are stored per author", async () => {
    restore = installMockApi();

    await expect(client().savePostDraft({ userId: "", eventId: null, text: "Собираемся", photoUrls: [], placeId: null, taggedFriendIds: [], audience: "friends", allowJoin: false })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    expect(mockPostDrafts.size).toBe(0);
  });
});
