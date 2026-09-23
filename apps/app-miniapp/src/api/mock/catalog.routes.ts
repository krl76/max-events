// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the catalog: the event and place listings, the event page aggregate and the participation block.
// SCOPE: GET /api/places[/:id[/page]], GET /api/events[/:id[/details]], GET /api/events/:id/participation/stats, PUT/DELETE /api/events/:id/participation. The PATCH variants of /api/events/:id and /api/places/:id belong to the organizer table, which runs before this one.
// DEPENDS: ./catalog.js, ./fixtures.js, ./promo.js, ../client.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - catalogRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { IdSchema, ParticipationStatusSchema } from "@max-events/api-contracts";
import type { Participation } from "@max-events/api-contracts";
import { parseEventFilters } from "../client";
import { eventDetails, filterMockEvents, mockParticipations, nextMockParticipationSeq, participationStats, placePageFor } from "./catalog";
import { mockEvents, mockPlaces, parseBookingBody } from "./fixtures";
import { MOCK_BOOSTED_EVENT_IDS, eventPromoted } from "./promo";

export function catalogRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/places") {
    // PlacesService.findAll lists published places only; an unpublished one is invisible, not just unopenable.
    return Response.json(mockPlaces.filter((row) => row.published !== false));
  }
  const placePage = /^\/api\/places\/([^/]+)\/page$/.exec(url.pathname);
  if (placePage) {
    const page = placePageFor(placePage[1], url.searchParams.get("userId") ?? "");
    return page ? Response.json(page) : new Response(null, { status: 404 });
  }
  const placeById = /^\/api\/places\/([^/]+)$/.exec(url.pathname);
  if (placeById && (init?.method ?? "GET") === "GET" && IdSchema.safeParse(placeById[1]).success) {
    // PlacesService.findOne treats published === false as absent, so an unpublished place 404s here too.
    const found = mockPlaces.find((item) => item.id === placeById[1] && item.published !== false);
    return found ? Response.json(found) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/events") {
    // EventsService.findAll queries where published: true, so a draft or an unpublished event is not listed.
    const events = filterMockEvents(
      mockEvents.filter((row) => row.published !== false),
      parseEventFilters(url.search),
    )
      .map(eventPromoted)
      .sort((a, b) => Number(MOCK_BOOSTED_EVENT_IDS.has(b.id)) - Number(MOCK_BOOSTED_EVENT_IDS.has(a.id)) || Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
    return Response.json(events);
  }
  const details = /^\/api\/events\/([^/]+)\/details$/.exec(url.pathname);
  if (details) {
    const payload = eventDetails(details[1], url.searchParams.get("userId") ?? "");
    return payload ? Response.json(payload) : new Response(null, { status: 404 });
  }
  const byId = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
  if (byId) {
    // Same as EventsService.findOne: an unpublished event is not found, not merely unlisted.
    const found = mockEvents.find((item) => item.id === byId[1] && item.published !== false);
    return found ? Response.json(eventPromoted(found)) : new Response(null, { status: 404 });
  }
  const stats = /^\/api\/events\/([^/]+)\/participation\/stats$/.exec(url.pathname);
  if (stats) {
    if (!mockEvents.some((item) => item.id === stats[1])) return new Response(null, { status: 404 });
    return Response.json(participationStats(stats[1], url.searchParams.get("userId") ?? ""));
  }
  const participation = /^\/api\/events\/([^/]+)\/participation$/.exec(url.pathname);
  if (participation && init?.method === "PUT") {
    const userId = url.searchParams.get("userId") ?? "";
    const parsed = ParticipationStatusSchema.safeParse(parseBookingBody(init)?.status);
    if (!parsed.success || userId === "") return new Response(null, { status: 400 });
    if (!mockEvents.some((item) => item.id === participation[1])) return new Response(null, { status: 404 });
    const now = new Date().toISOString();
    const key = `${userId}:${participation[1]}`;
    const existing = mockParticipations.get(key);
    const seq = nextMockParticipationSeq();
    const record: Participation = existing ? { ...existing, status: parsed.data, updatedAt: now } : { id: `f0000000-0000-4000-8000-${String(seq).padStart(12, "0")}`, userId, eventId: participation[1], status: parsed.data, createdAt: now, updatedAt: now };
    mockParticipations.set(key, record);
    return Response.json(record);
  }
  if (participation && init?.method === "DELETE") {
    const key = `${url.searchParams.get("userId") ?? ""}:${participation[1]}`;
    const existing = mockParticipations.get(key);
    if (!existing) return new Response(null, { status: 404 });
    mockParticipations.delete(key);
    return Response.json(existing);
  }
  return null;
}
