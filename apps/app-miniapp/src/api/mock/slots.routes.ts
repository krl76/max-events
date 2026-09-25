// START_MODULE_CONTRACT
// PURPOSE: Mock route table of the slot domain: the venue board, the windows of a venue, the bookings they produce and the viewer's own bookings, waiting positions and entry codes.
// SCOPE: GET /api/places/:id/board, GET /api/slots, POST /api/slots/bookings, GET/DELETE /api/slots/bookings/:id, GET /api/slots/my, DELETE /api/slots/waitlist/:id, GET /api/check-in-codes. The /places branch is narrower than the catalog one and runs after it, so the catalog keeps answering /api/places/:id.
// DEPENDS: ./slots.js, ./fixtures.js, ../endpoints/slots.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - slotsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import type { CreateSlotBooking } from "../endpoints/slots";
import { parseBookingBody } from "./fixtures";
import { cancelMockSlotBooking, createMockSlotBooking, leaveMockSlotWaitlist, mockCheckInCodes, mockMySlots, mockPlaceBoard, mockSlotBoard, mockSlotBookingScreen } from "./slots";

/** The body of POST /slots/bookings, validated the way the future DTO will be: ids as strings, the two lists present. */
function parseCreateBooking(init: RequestInit | undefined): CreateSlotBooking | null {
  const raw = parseBookingBody(init);
  if (typeof raw !== "object" || raw === null) return null;
  const { slotId, userId, companionIds, extraIds } = raw as Record<string, unknown>;
  if (typeof slotId !== "string" || slotId === "" || typeof userId !== "string" || userId === "") return null;
  if (!Array.isArray(companionIds) || !Array.isArray(extraIds)) return null;
  if (companionIds.some((id) => typeof id !== "string") || extraIds.some((id) => typeof id !== "string")) return null;
  return { slotId, userId, companionIds: companionIds as string[], extraIds: extraIds as string[] };
}

export function slotsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  const placeBoard = /^\/api\/places\/([^/]+)\/board$/.exec(url.pathname);
  if (placeBoard) {
    const userId = url.searchParams.get("userId") ?? "";
    const board = mockPlaceBoard(placeBoard[1], userId);
    return board === null ? new Response(null, { status: 404 }) : Response.json(board);
  }
  if (url.pathname === "/api/slots") {
    const placeId = url.searchParams.get("placeId");
    if (placeId === null || placeId === "") return new Response(null, { status: 400 });
    const board = mockSlotBoard(placeId, url.searchParams.get("date"));
    return board === null ? new Response(null, { status: 404 }) : Response.json(board);
  }
  if (url.pathname === "/api/slots/my") {
    return Response.json(mockMySlots(url.searchParams.get("userId") ?? ""));
  }
  if (url.pathname === "/api/slots/bookings" && init?.method === "POST") {
    const payload = parseCreateBooking(init);
    if (payload === null) return new Response(null, { status: 400 });
    const created = createMockSlotBooking(payload);
    // A window somebody took while the screen was open is a conflict, not a missing resource.
    if (created === "no_slot") return new Response(null, { status: 404 });
    if (created === "taken") return new Response(null, { status: 409 });
    return Response.json(created);
  }
  const bookingById = /^\/api\/slots\/bookings\/([^/]+)$/.exec(url.pathname);
  if (bookingById && init?.method === "DELETE") {
    const cancelled = cancelMockSlotBooking(bookingById[1]);
    return cancelled === null ? new Response(null, { status: 404 }) : Response.json(cancelled);
  }
  if (bookingById) {
    const screen = mockSlotBookingScreen(bookingById[1]);
    return screen === null ? new Response(null, { status: 404 }) : Response.json(screen);
  }
  const waitlistEntry = /^\/api\/slots\/waitlist\/([^/]+)$/.exec(url.pathname);
  if (waitlistEntry && init?.method === "DELETE") {
    const left = leaveMockSlotWaitlist(waitlistEntry[1]);
    return left === null ? new Response(null, { status: 404 }) : Response.json(left);
  }
  if (url.pathname === "/api/check-in-codes") {
    return Response.json(mockCheckInCodes(url.searchParams.get("userId") ?? ""));
  }
  return null;
}
