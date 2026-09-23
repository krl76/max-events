// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the booking path: the ticket booking with its two-phase sandbox payment, the cancellation refund, the waitlist and the check-in.
// SCOPE: POST /api/bookings, POST /api/bookings/:id/payment, DELETE /api/bookings/:id, POST /api/check-ins, POST /api/waitlist, GET /api/waitlist/me, POST /api/waitlist/:id/(confirm|decline).
// DEPENDS: ./bookings.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - bookingsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { CreateBookingSchema } from "@max-events/api-contracts";
import type { Booking } from "@max-events/api-contracts";
import { confirmMockWaitlistOffer, createMockCheckIn, declineMockWaitlistOffer, ensureMockPayment, joinMockWaitlist, mockBookingWithSeats, mockBookings, mockPayments, myMockWaitlistEntry, nextMockBookingSeq, offerNextMockWaitlist, redeemMockPromoCode, remainingSeats, settleMockPayment } from "./bookings";
import { mockEvents, parseBookingBody } from "./fixtures";

export function bookingsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/bookings" && init?.method === "POST") {
    const parsed = CreateBookingSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    if (!mockEvents.some((item) => item.id === parsed.data.eventId)) return new Response(null, { status: 404 });
    const existing = mockBookings.find((booking) => booking.eventId === parsed.data.eventId && booking.userId === parsed.data.userId && booking.status === "active");
    if (existing) return new Response(null, { status: 409 });
    if (remainingSeats(parsed.data.eventId) === 0) return new Response(null, { status: 409 });
    const promo = redeemMockPromoCode(parsed.data.eventId, parsed.data.promoCode);
    if (promo === "forbidden") return new Response(null, { status: 403 });
    const now = new Date().toISOString();
    const seq = nextMockBookingSeq();
    const booking: Booking = { id: `e0000000-0000-4000-8000-${String(seq).padStart(12, "0")}`, userId: parsed.data.userId, eventId: parsed.data.eventId, status: "active", createdAt: now, updatedAt: now };
    mockBookings.push(booking);
    ensureMockPayment(booking, now);
    return Response.json(mockBookingWithSeats(booking));
  }
  const payBooking = /^\/api\/bookings\/([^/]+)\/payment$/.exec(url.pathname);
  if (payBooking && init?.method === "POST") {
    const booking = mockBookings.find((item) => item.id === payBooking[1]);
    if (!booking) return new Response(null, { status: 404 });
    if (booking.status !== "active") return new Response(null, { status: 409 });
    const now = new Date().toISOString();
    const payment = ensureMockPayment(booking, now);
    if (payment !== null) settleMockPayment(payment, now);
    return Response.json(mockBookingWithSeats(booking));
  }
  const cancel = /^\/api\/bookings\/([^/]+)$/.exec(url.pathname);
  if (cancel && init?.method === "DELETE") {
    // ponytail: wontfix ownership check (backend -> 403 for a foreign user) — the mock has no auth context on
    // DELETE /bookings/:id (ApiClient.cancelBooking sends no actor id), so an owner assert is not enforceable without
    // expanding the client surface; the sandbox is single-identity (everything acts as mockDemoUser).
    const booking = mockBookings.find((item) => item.id === cancel[1]);
    if (!booking) return new Response(null, { status: 404 });
    if (booking.status !== "cancelled") {
      booking.status = "cancelled";
      booking.updatedAt = new Date().toISOString();
      offerNextMockWaitlist(booking.eventId, new Date());
    }
    // refundForBooking parity: a succeeded payment is refunded (idempotent), other statuses pass through
    const payment = mockPayments.find((item) => item.bookingId === booking.id);
    if (payment?.status === "succeeded") {
      payment.status = "refunded";
      payment.updatedAt = new Date().toISOString();
    }
    return Response.json(mockBookingWithSeats(booking));
  }
  if (url.pathname === "/api/check-ins" && init?.method === "POST") {
    const payload = parseBookingBody(init) as { userId?: string; eventId?: string; placeId?: string } | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string") return new Response(null, { status: 400 });
    const result = createMockCheckIn(payload.userId, { eventId: payload.eventId, placeId: payload.placeId });
    return result === "invalid" ? new Response(null, { status: 400 }) : result === "no_target" ? new Response(null, { status: 404 }) : Response.json(result);
  }
  if (url.pathname === "/api/waitlist" && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    const payload = parseBookingBody(init) as { eventId?: string } | undefined;
    if (userId === "" || typeof payload !== "object" || payload === null || typeof payload.eventId !== "string") return new Response(null, { status: 400 });
    const result = joinMockWaitlist(payload.eventId, userId);
    return result === "no_event" ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  if (url.pathname === "/api/waitlist/me") {
    const eventId = url.searchParams.get("eventId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (eventId === "" || userId === "") return new Response(null, { status: 400 });
    const entry = myMockWaitlistEntry(eventId, userId);
    return entry ? Response.json(entry) : new Response(null, { status: 404 });
  }
  const waitlistAction = /^\/api\/waitlist\/([^/]+)\/(confirm|decline)$/.exec(url.pathname);
  if (waitlistAction && init?.method === "POST") {
    if (waitlistAction[2] === "confirm") {
      const result = confirmMockWaitlistOffer(waitlistAction[1]);
      return result === null ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    const result = declineMockWaitlistOffer(waitlistAction[1]);
    return result === null ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  return null;
}
