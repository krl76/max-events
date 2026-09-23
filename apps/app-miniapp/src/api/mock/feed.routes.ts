// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the stories rail and the impression wall.
// SCOPE: GET/POST /api/stories, GET /api/feed/cards, GET /api/notifications/summary, GET/POST /api/feed, POST /api/feed/:id/like, POST /api/feed/:id/comments.
// DEPENDS: ./feed.js, ./fixtures.js, ../client.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - feedRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { type CreateFeedPost } from "../client";
import { addMockFeedComment, createMockFeedPost, createMockStory, feedPosts, listMockStories, mockFeedCards, mockNotificationsSummary, toggleMockFeedLike } from "./feed";
import { parseBookingBody } from "./fixtures";

export function feedRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/stories" && init?.method === "POST") {
    const body = parseBookingBody(init);
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;
    if (imageUrl === null || imageUrl === "") return new Response(null, { status: 400 });
    return Response.json(createMockStory(imageUrl));
  }
  if (url.pathname === "/api/stories") {
    return Response.json(listMockStories());
  }
  if (url.pathname === "/api/feed/cards") {
    return Response.json(mockFeedCards(url.searchParams.get("userId") ?? ""));
  }
  // Answered here rather than in a table of its own: the notifications domain does not exist yet (#494), only the header that reads it.
  if (url.pathname === "/api/notifications/summary") {
    return Response.json(mockNotificationsSummary());
  }
  if (url.pathname === "/api/feed" && init?.method === "POST") {
    const payload = parseBookingBody(init) as CreateFeedPost | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.eventId !== "string" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
    const post = createMockFeedPost(payload);
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/feed") {
    return Response.json(feedPosts(url.searchParams.get("eventId"), url.searchParams.get("placeId")));
  }
  const feedLike = /^\/api\/feed\/([^/]+)\/like$/.exec(url.pathname);
  if (feedLike && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const post = toggleMockFeedLike(feedLike[1], userId);
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  const feedComment = /^\/api\/feed\/([^/]+)\/comments$/.exec(url.pathname);
  if (feedComment && init?.method === "POST") {
    const payload = parseBookingBody(init) as { userId?: string; text?: string } | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
    const post = addMockFeedComment(feedComment[1], { userId: payload.userId, text: payload.text });
    return post ? Response.json(post) : new Response(null, { status: 404 });
  }
  return null;
}
