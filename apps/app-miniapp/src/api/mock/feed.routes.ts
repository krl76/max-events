// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the stories rail, the impression wall and the two publication screens (макет, экраны 05 и 06).
// SCOPE: GET/POST /api/stories, GET /api/feed/cards, GET/POST /api/feed, POST /api/feed/drafts, POST /api/feed/:id/like, POST /api/feed/:id/comments; the unread count behind the header bell moved to ./notifications.routes.ts with the rest of that domain.
// DEPENDS: ./feed.js, ./fixtures.js, ../client.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - feedRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { type CreateFeedPost, type PostDraft, type StoryComposition } from "../client";
import { addMockFeedComment, createMockFeedPost, createMockStory, deleteMockFeedPost, feedPosts, listMockStories, mockFeedCards, repostMockFeedEvent, repostMockFeedPost, saveMockPostDraft, toggleMockFeedGoing, toggleMockFeedLike } from "./feed";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { userPostsFor } from "./profile";

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * The composed part of a story body (макет, экран 05). Absent is a valid answer — the stories rail
 * publishes a bare photo — but a half-built composition is not: the real endpoint will refuse it too,
 * so a malformed sticker or poll has to come back as a 400 rather than publish silently stripped.
 */
function parseStoryComposition(body: Record<string, unknown> | null | undefined): { ok: true; value: StoryComposition | null } | { ok: false } {
  if (body === undefined || body === null || body.audience === undefined) return { ok: true, value: null };
  if (body.audience !== "close-friends" && body.audience !== "friends" && body.audience !== "city") return { ok: false };
  if (typeof body.text !== "string") return { ok: false };
  let sticker: StoryComposition["sticker"] = null;
  if (body.sticker !== null && body.sticker !== undefined) {
    const raw = body.sticker as Record<string, unknown>;
    if (typeof raw.eventId !== "string" || typeof raw.title !== "string" || typeof raw.subtitle !== "string") return { ok: false };
    if (raw.seatsLeft !== null && typeof raw.seatsLeft !== "number") return { ok: false };
    sticker = { eventId: raw.eventId, title: raw.title, subtitle: raw.subtitle, seatsLeft: raw.seatsLeft };
  }
  let poll: StoryComposition["poll"] = null;
  if (body.poll !== null && body.poll !== undefined) {
    const raw = body.poll as Record<string, unknown>;
    if (typeof raw.question !== "string" || !isStringArray(raw.options)) return { ok: false };
    if (raw.answer !== null && typeof raw.answer !== "number") return { ok: false };
    poll = { question: raw.question, options: raw.options, answer: raw.answer };
  }
  const value: StoryComposition = { text: body.text, sticker, poll, audience: body.audience };
  if (Array.isArray(body.objects)) value.objects = body.objects as StoryComposition["objects"];
  return { ok: true, value };
}

export function feedRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/stories" && init?.method === "POST") {
    const body = parseBookingBody(init);
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;
    if (imageUrl === null || imageUrl === "") return new Response(null, { status: 400 });
    const composition = parseStoryComposition(body);
    if (!composition.ok) return new Response(null, { status: 400 });
    return Response.json(createMockStory(imageUrl, composition.value));
  }
  if (url.pathname === "/api/stories") {
    return Response.json(listMockStories());
  }
  if (url.pathname === "/api/feed/cards") {
    return Response.json(mockFeedCards(url.searchParams.get("userId") ?? ""));
  }
  // Ahead of /api/feed on purpose only for readability — the paths are matched exactly, so the order is free.
  if (url.pathname === "/api/feed/drafts" && init?.method === "POST") {
    const draft = parseBookingBody(init) as PostDraft | undefined;
    if (typeof draft !== "object" || draft === null || typeof draft.userId !== "string" || draft.userId === "" || typeof draft.text !== "string") return new Response(null, { status: 400 });
    return Response.json(saveMockPostDraft(draft));
  }
  if (url.pathname === "/api/feed" && init?.method === "POST") {
    const payload = parseBookingBody(init) as CreateFeedPost | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || (payload.eventId !== null && typeof payload.eventId !== "string") || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
    const post = createMockFeedPost(payload);
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/feed") {
    return Response.json(feedPosts(url.searchParams.get("eventId"), url.searchParams.get("placeId")));
  }
  const feedOne = /^\/api\/feed\/([^/]+)$/.exec(url.pathname);
  if (feedOne && init?.method === "DELETE") {
    const userId = url.searchParams.get("userId") ?? mockDemoUser.id;
    return deleteMockFeedPost(feedOne[1]!, userId) ? new Response(null, { status: 204 }) : new Response(null, { status: 404 });
  }
  if (feedOne && (init?.method === undefined || init.method === "GET")) {
    const fromWall = feedPosts(null).find((row) => row.id === feedOne[1]);
    if (fromWall) return Response.json(fromWall);
    const tile = userPostsFor(mockDemoUser.id).find((row) => row.postId === feedOne[1]);
    if (!tile) return new Response(null, { status: 404 });
    return Response.json({
      id: tile.postId,
      author: { id: mockDemoUser.id, name: mockDemoUser.firstName, avatarUrl: mockDemoUser.avatarUrl },
      eventId: tile.eventId,
      text: tile.eventTitle,
      photoUrl: tile.photoUrl,
      placeId: null,
      taggedFriendIds: [],
      audience: "friends",
      allowJoin: false,
      likesCount: tile.likesCount,
      likedByMe: false,
      comments: [],
    });
  }
  const feedLike = /^\/api\/feed\/([^/]+)\/like$/.exec(url.pathname);
  if (feedLike && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const post = toggleMockFeedLike(feedLike[1], userId);
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  const feedEventRepost = /^\/api\/feed\/events\/([^/]+)\/repost$/.exec(url.pathname);
  if (feedEventRepost && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const post = repostMockFeedEvent(userId, feedEventRepost[1]);
    if (post === "dup") return new Response(null, { status: 409 });
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  const feedRepost = /^\/api\/feed\/([^/]+)\/repost$/.exec(url.pathname);
  if (feedRepost && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const post = repostMockFeedPost(userId, feedRepost[1]);
    if (post === "own") return new Response(null, { status: 400 });
    if (post === "dup") return new Response(null, { status: 409 });
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  const feedGoing = /^\/api\/feed\/([^/]+)\/going$/.exec(url.pathname);
  if (feedGoing && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const post = toggleMockFeedGoing(userId, feedGoing[1]);
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  const feedComment = /^\/api\/feed\/([^/]+)\/comments$/.exec(url.pathname);
  if (feedComment && init?.method === "POST") {
    const payload = parseBookingBody(init) as { userId?: string; text?: string; parentId?: string | null } | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
    const post = addMockFeedComment(feedComment[1], { userId: payload.userId, text: payload.text, parentId: payload.parentId });
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  return null;
}
