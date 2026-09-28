// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the lists and the follows of the viewer.
// SCOPE: PATCH/DELETE/GET /api/lists/:id, GET/POST /api/subscriptions, DELETE /api/subscriptions/:id, GET/POST /api/lists, GET/POST /api/lists/:id/items, DELETE /api/lists/:id/items/:itemId.
// DEPENDS: ./lists.js, ./fixtures.js, ../client.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - listsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { CreateListWriteSchema, CreateSubscriptionSchema, IdSchema, SetListVisibilitySchema } from "@max-events/api-contracts";
import { type AddListItem } from "../client";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { addMockListItem, createMockList, createMockSubscription, listItemCards, listMockSubscriptions, listScreen, listSummaries, removeMockList, removeMockListItem, removeMockSubscription, renameMockList, setMockListVisibility } from "./lists";

export function listsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  const listVisibility = /^\/api\/lists\/([^/]+)\/visibility$/.exec(url.pathname);
  if (listVisibility && init?.method === "PATCH") {
    if (!IdSchema.safeParse(listVisibility[1]).success) return new Response(null, { status: 400 });
    const parsed = SetListVisibilitySchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const updated = setMockListVisibility(listVisibility[1], parsed.data.visibility);
    return updated === "no_list" ? new Response(null, { status: 404 }) : updated === "preset" ? new Response(null, { status: 403 }) : Response.json(updated);
  }

  const listById = /^\/api\/lists\/([^/]+)$/.exec(url.pathname);
  if (listById && init?.method === "PATCH") {
    // ParseUUIDPipe answers 400 on the backend, so a non-uuid must not read as "no such list".
    if (!IdSchema.safeParse(listById[1]).success) return new Response(null, { status: 400 });
    const parsed = CreateListWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const renamed = renameMockList(listById[1], parsed.data.title);
    return renamed === "no_list" ? new Response(null, { status: 404 }) : renamed === "preset" ? new Response(null, { status: 403 }) : Response.json(renamed);
  }
  if (listById && init?.method === "DELETE") {
    if (!IdSchema.safeParse(listById[1]).success) return new Response(null, { status: 400 });
    const removed = removeMockList(listById[1]);
    return removed === "no_list" ? new Response(null, { status: 404 }) : removed === "preset" ? new Response(null, { status: 403 }) : Response.json(removed);
  }
  if (listById) {
    const screen = listScreen(listById[1]);
    return screen ? Response.json(screen) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/subscriptions" && init?.method === "POST") {
    const parsed = CreateSubscriptionSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const created = createMockSubscription(parsed.data);
    return created === "unknown" ? new Response(null, { status: 404 }) : Response.json(created);
  }
  if (url.pathname === "/api/subscriptions") {
    return Response.json(listMockSubscriptions());
  }
  const subscriptionRemove = /^\/api\/subscriptions\/([^/]+)$/.exec(url.pathname);
  if (subscriptionRemove && init?.method === "DELETE") {
    const removed = removeMockSubscription(subscriptionRemove[1]);
    return removed === "unknown" ? new Response(null, { status: 404 }) : Response.json(removed);
  }
  if (url.pathname === "/api/lists" && init?.method === "POST") {
    const parsed = CreateListWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const created = createMockList(mockDemoUser.id, parsed.data.title);
    return created === "too_many" ? new Response(null, { status: 409 }) : Response.json(created);
  }
  if (url.pathname === "/api/lists") {
    return Response.json(listSummaries(url.searchParams.get("userId") ?? "", url.searchParams.get("eventId"), url.searchParams.get("feedPostId")));
  }
  const listItems = /^\/api\/lists\/([^/]+)\/items$/.exec(url.pathname);
  if (listItems && init?.method === "POST") {
    const payload = parseBookingBody(init) as AddListItem | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "") return new Response(null, { status: 400 });
    const named = [typeof payload.eventId === "string", typeof payload.placeId === "string", typeof payload.feedPostId === "string"].filter(Boolean).length;
    if (named !== 1) return new Response(null, { status: 400 });
    const result = addMockListItem(listItems[1], payload);
    return result === "no_list" || result === "no_event" || result === "no_post" ? new Response(null, { status: 404 }) : Response.json(result);
  }
  if (listItems) {
    const cards = listItemCards(listItems[1]);
    return cards ? Response.json(cards) : new Response(null, { status: 404 });
  }
  const listItemRemove = /^\/api\/lists\/([^/]+)\/items\/([^/]+)$/.exec(url.pathname);
  if (listItemRemove && init?.method === "DELETE") {
    const removed = removeMockListItem(listItemRemove[1], listItemRemove[2]);
    return removed ? Response.json(removed) : new Response(null, { status: 404 });
  }
  return null;
}
