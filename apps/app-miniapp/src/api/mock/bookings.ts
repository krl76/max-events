// START_MODULE_CONTRACT
// PURPOSE: Mock booking store: bookings with their two-phase sandbox payment, promo codes, the FIFO waitlist and check-ins.
// SCOPE: In-memory bookings/payments/waitlist/check-ins and the seat arithmetic; the HTTP surface is in ./bookings.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockBookings - shared with bookings.routes, catalog, groups, organizer, plans
// - nextMockBookingSeq - Bumps and returns the booking sequence; the route table creates bookings from its own module, and an imported binding is read-only
// - mockPayments - shared with bookings.routes, organizer
// - MOCK_SANDBOX_FAIL_AMOUNT - sandbox fail amount: a charge of exactly this sum is declined (#213)
// - ensureMockPayment - Mirrors PaymentsService.ensureForBooking: the payment of a booking is created once (pending at booking time) and then returned as-is; free/unpriced events have none
// - MOCK_COMMISSION_BPS - 10% platform fee frozen when a mock payment settles (backend DEFAULT_COMMISSION_BPS / freezeCommission parity)
// - settleMockPayment - Mirrors the sandbox charge rule: a pending payment resolves to failed at the fail amount (or a "[fail]" title marker), otherwise succeeded; settled payments stay untouched. A succeeded charge freezes the commission once (backend freezeCommission parity)
// - mockBookingWithSeats - BookingWithSeats response shape (backend toBookingDto + payment parity)
// - resetMockBookings - clear in-memory bookings and payments (test isolation)
// - MOCK_PROMO_CODE - seeded unlimited promo code for the early-access event
// - MOCK_SINGLE_USE_PROMO_CODE - seeded single-use promo code (the exhausted path)
// - resetMockPromo - restore seeded promo codes and redemption counters (test isolation)
// - redeemMockPromoCode - Backend PromoService.redeemInTransaction parity: no window and no code pass; a window without a code, an unknown/expired/exhausted code are forbidden (403 in the interceptor)
// - OFFER_TTL_MS - 15-minute confirmation window of a waitlist offer
// - resetMockWaitlist - clear the in-memory waitlist (test isolation)
// - offerNextMockWaitlist - Offers a freed seat to the first waiting entry (15-minute confirmation window); the offered seat stays reserved
// - joinMockWaitlist - Joins the queue of a sold-out event; "no_event"/"seats_available"/"duplicate"/"booked" map to 404/409 in the interceptor
// - myMockWaitlistEntry - Active (waiting|offered) entry of a user for an event with its FIFO position, or null (mock GET /waitlist/me)
// - confirmMockWaitlistOffer - Confirms an offer into a booking on the reserved seat (no capacity re-check); null/"not_offered"/"offer_expired" map to 404/409 in the interceptor
// - declineMockWaitlistOffer - Cancels a queue entry; a declined offer passes the reserved seat to the next waiting entry. Idempotent for cancelled entries; "already_confirmed"/"offer_expired" map to 409, null to 404 (mock 404)
// - mockCheckIns - shared with catalog, discover, organizer, profile, social
// - resetMockCheckIns - clear in-memory check-ins (test isolation)
// - checkInFor - Check-in of a user for an event, or null (mock state for the event page button)
// - createMockCheckIn - in-memory check-in for an event or a place, idempotent (mock POST)
// - remainingSeats - shared with bookings.routes, catalog, discover
// - waitlistAheadCount - how many people are already queued for an event: the «7 впереди» of экран 18 (#496)
// END_MODULE_MAP

import type { Booking, BookingWithSeats, CheckIn, Payment, WaitlistEntry } from "@max-events/api-contracts";
import { MOCK_BOOKING_OPENS_AT, MOCK_EARLY_ACCESS_EVENT_ID, PLACE_STAMP, mockDemoUser, mockEvents, mockFriendIds, mockPlaces } from "./fixtures";

export const mockBookings: Booking[] = [];

let mockBookingSeq = 0;

/** Bumps and returns the booking sequence; the route table creates bookings from its own module, and an imported binding is read-only. */
export function nextMockBookingSeq(): number {
  mockBookingSeq += 1;
  return mockBookingSeq;
}

export const mockPayments: Payment[] = [];

let mockPaymentSeq = 0;

/** Sandbox fail amount (backend SANDBOX_FAIL_AMOUNT parity): a charge of exactly this sum is declined, as is a title containing "[fail]". */
export const MOCK_SANDBOX_FAIL_AMOUNT = 13;

/** Mirrors PaymentsService.ensureForBooking: the payment of a booking is created once (pending at booking time) and then returned as-is; free/unpriced events have none. */
export function ensureMockPayment(booking: Booking, now: string): Payment | null {
  const event = mockEvents.find((item) => item.id === booking.eventId);
  if (!event || !event.isPaid || event.priceRub === null || event.priceRub <= 0) return null;
  const existing = mockPayments.find((item) => item.bookingId === booking.id);
  if (existing) return existing;
  mockPaymentSeq += 1;
  const payment: Payment = {
    id: `70000000-0000-4000-8000-${String(mockPaymentSeq).padStart(12, "0")}`,
    bookingId: booking.id,
    providerPaymentId: `pay_sandbox_${booking.id}`,
    status: "pending",
    amountRub: event.priceRub,
    currency: "RUB",
    description: `Билет: ${event.title}`,
    commissionRub: null,
    netRub: null,
    commissionBps: null,
    commissionFixedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  mockPayments.push(payment);
  return payment;
}

/** 10% platform fee frozen when a mock payment settles (backend DEFAULT_COMMISSION_BPS / freezeCommission parity). */
export const MOCK_COMMISSION_BPS = 1000;

/** Mirrors the sandbox charge rule: a pending payment resolves to failed at the fail amount (or a "[fail]" title marker), otherwise succeeded; settled payments stay untouched. A succeeded charge freezes the commission once (backend freezeCommission parity). */
export function settleMockPayment(payment: Payment, now: string): Payment {
  if (payment.status !== "pending") return payment;
  const event = mockEvents.find((item) => item.id === (mockBookings.find((booking) => booking.id === payment.bookingId)?.eventId ?? ""));
  payment.status = payment.amountRub === MOCK_SANDBOX_FAIL_AMOUNT || (event?.title.includes("[fail]") ?? false) ? "failed" : "succeeded";
  payment.updatedAt = now;
  if (payment.status === "succeeded" && payment.commissionFixedAt === null) {
    payment.commissionBps = MOCK_COMMISSION_BPS;
    payment.commissionRub = Math.floor((payment.amountRub * MOCK_COMMISSION_BPS) / 10_000);
    payment.netRub = payment.amountRub - payment.commissionRub;
    payment.commissionFixedAt = now;
  }
  return payment;
}

/** BookingWithSeats response shape (backend toBookingDto + payment parity). */
export function mockBookingWithSeats(booking: Booking): BookingWithSeats {
  const event = mockEvents.find((item) => item.id === booking.eventId);
  return {
    ...booking,
    freeSeats: remainingSeats(booking.eventId),
    chatLink: event?.chatLink ?? null,
    payment: mockPayments.find((item) => item.bookingId === booking.id) ?? null,
  };
}

/** Past fixture event of the demo user, so the post-event review flow ("Как прошло?") is reachable in the demo. */
const SEEDED_PAST_EVENT_ID = "c000000d-0000-4000-8000-00000000000d";

/** The demo user's paid ticket: the nearest event with a price, so «Мои брони» opens on a real ticket and not on an empty list. */
const SEEDED_TICKET_EVENT_ID = "c0000001-0000-4000-8000-000000000001";

/** Event of the seeded «Мы»-группы: its «Брони» block counts the bookings of the members, and without one the block is blank. */
const SEEDED_GROUP_EVENT_ID = "c0000003-0000-4000-8000-000000000003";

/** Almost sold out (capacity 20): 16 seats taken leave the «осталось 4» of макет, экран 17, and the «Мест почти нет» of экран 18. */
const SEEDED_ALMOST_FULL_EVENT_ID = "c0000008-0000-4000-8000-000000000008";

/** Sold out (capacity 15) with a queue behind it: the only state in which экран 18 draws the waitlist at all. */
const SEEDED_SOLD_OUT_EVENT_ID = "c0000004-0000-4000-8000-000000000004";

/**
 * Seat holders who are nobody in particular: the crowd that fills an event is not in the friend
 * fixtures and must not leak into a «кто идёт» row, so these ids match no Friend, no member and no
 * organizer — they are seats taken, and the seat arithmetic is all they are read by.
 */
function seededGuestId(index: number): string {
  return `a0000000-0000-4000-8000-9000000000${String(index).padStart(2, "0")}`;
}

function seedBooking(userId: string, eventId: string): Booking {
  mockBookingSeq += 1;
  const booking: Booking = { id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId, eventId, status: "active", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
  mockBookings.push(booking);
  return booking;
}

/**
 * Module-load seed; test resets clear it (resetMockBookings).
 *
 * An empty booking store leaves half the demo unreachable: «Мои брони» has nothing to list, the
 * «Брони» block of a «Мы»-группа is blank, and every event reports every seat free — so экран 17
 * never says «осталось 4», экран 18 never says «Мест почти нет» and its waitlist, which only exists
 * once the seats are gone, cannot be reached at all. The three friends on the almost-full event are
 * friends on purpose: «уже с билетами» on экран 18 names people the viewer knows.
 */
function seedMockBookings(): void {
  seedBooking(mockDemoUser.id, SEEDED_PAST_EVENT_ID);
  seedBooking(mockDemoUser.id, SEEDED_GROUP_EVENT_ID);
  const ticket = seedBooking(mockDemoUser.id, SEEDED_TICKET_EVENT_ID);
  const payment = ensureMockPayment(ticket, PLACE_STAMP);
  if (payment !== null) settleMockPayment(payment, PLACE_STAMP);
  for (const friendId of mockFriendIds.slice(0, 3)) seedBooking(friendId, SEEDED_ALMOST_FULL_EVENT_ID);
  for (let index = 1; index <= 13; index += 1) seedBooking(seededGuestId(index), SEEDED_ALMOST_FULL_EVENT_ID);
  for (let index = 14; index <= 28; index += 1) seedBooking(seededGuestId(index), SEEDED_SOLD_OUT_EVENT_ID);
}
seedMockBookings();

export function resetMockBookings(): void {
  mockBookings.length = 0;
  mockBookingSeq = 0;
  mockPayments.length = 0;
  mockPaymentSeq = 0;
}

/** Unlimited promo code seeded for the early-access fixture event. */
export const MOCK_PROMO_CODE = "VIP2026";

/** Single-use promo code seeded for the early-access fixture event (the exhausted path). */
export const MOCK_SINGLE_USE_PROMO_CODE = "LAST1";

interface MockPromoCode {
  eventId: string;
  code: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
}

const mockPromoCodes: MockPromoCode[] = [];

function seedMockPromoCodes(): void {
  mockPromoCodes.length = 0;
  mockPromoCodes.push({ eventId: MOCK_EARLY_ACCESS_EVENT_ID, code: MOCK_PROMO_CODE, maxRedemptions: null, redeemedCount: 0, expiresAt: null });
  mockPromoCodes.push({ eventId: MOCK_EARLY_ACCESS_EVENT_ID, code: MOCK_SINGLE_USE_PROMO_CODE, maxRedemptions: 1, redeemedCount: 0, expiresAt: null });
}
seedMockPromoCodes();

/** Restore the seeded promo codes and their redemption counters (test isolation). */
export function resetMockPromo(): void {
  seedMockPromoCodes();
}

/** Backend PromoService.redeemInTransaction parity: no window and no code pass; a window without a code, an unknown/expired/exhausted code are forbidden (403 in the interceptor). */
export function redeemMockPromoCode(eventId: string, rawCode: string | null | undefined, now: Date = new Date()): { applied: string | null } | "forbidden" {
  const early = eventId === MOCK_EARLY_ACCESS_EVENT_ID && now.getTime() < new Date(MOCK_BOOKING_OPENS_AT).getTime();
  const code = rawCode?.trim().toUpperCase();
  if (!early && !code) return { applied: null };
  if (!code) return "forbidden";
  const row = mockPromoCodes.find((item) => item.eventId === eventId && item.code === code);
  if (!row) return "forbidden";
  if (row.expiresAt !== null && new Date(row.expiresAt).getTime() <= now.getTime()) return "forbidden";
  if (row.maxRedemptions !== null && row.redeemedCount >= row.maxRedemptions) return "forbidden";
  row.redeemedCount += 1;
  return { applied: code };
}

/** Confirmation window of a waitlist offer (mirrors the backend OFFER_TTL_MS). */
export const OFFER_TTL_MS = 15 * 60 * 1000;

const mockWaitlist: WaitlistEntry[] = [];

let mockWaitlistSeq = 0;

export function resetMockWaitlist(): void {
  mockWaitlist.length = 0;
  mockWaitlistSeq = 0;
}

/**
 * Module-load seed; test resets clear it (resetMockWaitlist).
 *
 * Seven people wait for the sold-out fixture, the demo user last: that is the «7 впереди» of макет,
 * экран 18 for anyone outside the queue, and the position «Мои брони» prints for the demo user
 * inside it. Every entry is «waiting» and none is «offered», so the queue reserves no seat and the
 * seat arithmetic of the event stays exactly what the bookings made it.
 */
function seedMockWaitlist(): void {
  const stamp = (minute: number): string => new Date(new Date(PLACE_STAMP).getTime() + minute * 60_000).toISOString();
  const enqueue = (userId: string): void => {
    mockWaitlistSeq += 1;
    mockWaitlist.push({ id: `82000000-0000-4000-8000-${String(mockWaitlistSeq).padStart(12, "0")}`, userId, eventId: SEEDED_SOLD_OUT_EVENT_ID, position: 0, status: "waiting", offeredUntil: null, createdAt: stamp(mockWaitlistSeq), updatedAt: stamp(mockWaitlistSeq) });
  };
  for (let index = 29; index <= 34; index += 1) enqueue(seededGuestId(index));
  enqueue(mockDemoUser.id);
}
seedMockWaitlist();

/** Queue entries of an event (waiting|offered) in FIFO order. */
function waitlistQueue(eventId: string): WaitlistEntry[] {
  return mockWaitlist.filter((entry) => entry.eventId === eventId && (entry.status === "waiting" || entry.status === "offered")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function withWaitlistPosition(entry: WaitlistEntry): WaitlistEntry {
  const queue = waitlistQueue(entry.eventId);
  const index = queue.findIndex((item) => item.id === entry.id);
  return { ...entry, position: index === -1 ? queue.length + 1 : index + 1 };
}

/** Offers a freed seat to the first waiting entry (15-minute confirmation window); the offered seat stays reserved. */
export function offerNextMockWaitlist(eventId: string, now: Date): void {
  const next = waitlistQueue(eventId).find((entry) => entry.status === "waiting");
  if (!next) return;
  next.status = "offered";
  next.offeredUntil = new Date(now.getTime() + OFFER_TTL_MS).toISOString();
  next.updatedAt = now.toISOString();
}

/** Lazy offer expiry: a due offer flips to expired and the seat passes to the next waiting entry. */
function refreshMockWaitlist(eventId: string, now: Date = new Date()): void {
  for (const entry of mockWaitlist) {
    if (entry.eventId !== eventId || entry.status !== "offered" || entry.offeredUntil === null) continue;
    if (new Date(entry.offeredUntil).getTime() > now.getTime()) continue;
    entry.status = "expired";
    entry.offeredUntil = null;
    entry.updatedAt = now.toISOString();
    offerNextMockWaitlist(eventId, now);
  }
}

/** Joins the queue of a sold-out event; "no_event"/"seats_available"/"duplicate"/"booked" map to 404/409 in the interceptor. */
export function joinMockWaitlist(eventId: string, userId: string): WaitlistEntry | "no_event" | "seats_available" | "duplicate" | "booked" {
  if (!mockEvents.some((item) => item.id === eventId)) return "no_event";
  if ((remainingSeats(eventId) ?? 1) > 0) return "seats_available";
  if (mockBookings.some((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active")) return "booked";
  if (waitlistQueue(eventId).some((entry) => entry.userId === userId)) return "duplicate";
  const now = new Date().toISOString();
  mockWaitlistSeq += 1;
  const entry: WaitlistEntry = { id: `82000000-0000-4000-8000-${String(mockWaitlistSeq).padStart(12, "0")}`, userId, eventId, position: 0, status: "waiting", offeredUntil: null, createdAt: now, updatedAt: now };
  mockWaitlist.push(entry);
  return withWaitlistPosition(entry);
}

/** Active (waiting|offered) entry of a user for an event with its FIFO position, or null (mock GET /waitlist/me). */
export function myMockWaitlistEntry(eventId: string, userId: string): WaitlistEntry | null {
  refreshMockWaitlist(eventId);
  const entry = waitlistQueue(eventId).find((item) => item.userId === userId);
  return entry === undefined ? null : withWaitlistPosition(entry);
}

/** Confirms an offer into a booking on the reserved seat (no capacity re-check); null/"not_offered"/"offer_expired" map to 404/409 in the interceptor. */
export function confirmMockWaitlistOffer(entryId: string): WaitlistEntry | null | "not_offered" | "offer_expired" {
  const entry = mockWaitlist.find((item) => item.id === entryId);
  if (!entry) return null;
  refreshMockWaitlist(entry.eventId);
  if (entry.status === "confirmed") return withWaitlistPosition(entry);
  if (entry.status === "expired") return "offer_expired";
  if (entry.status !== "offered" || entry.offeredUntil === null) return "not_offered";
  const position = withWaitlistPosition(entry).position;
  const now = new Date().toISOString();
  mockBookingSeq += 1;
  const booking: Booking = { id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: entry.userId, eventId: entry.eventId, status: "active", createdAt: now, updatedAt: now };
  mockBookings.push(booking);
  ensureMockPayment(booking, now);
  entry.status = "confirmed";
  entry.offeredUntil = null;
  entry.updatedAt = now;
  return { ...entry, position };
}

/** Cancels a queue entry; a declined offer passes the reserved seat to the next waiting entry. Idempotent for cancelled entries; "already_confirmed"/"offer_expired" map to 409, null to 404 (mock 404). */
export function declineMockWaitlistOffer(entryId: string): WaitlistEntry | null | "already_confirmed" | "offer_expired" {
  const entry = mockWaitlist.find((item) => item.id === entryId);
  if (!entry) return null;
  refreshMockWaitlist(entry.eventId);
  if (entry.status === "cancelled") return withWaitlistPosition(entry);
  if (entry.status === "confirmed") return "already_confirmed";
  if (entry.status === "expired") return "offer_expired";
  const wasOffered = entry.status === "offered";
  const now = new Date();
  entry.status = "cancelled";
  entry.offeredUntil = null;
  entry.updatedAt = now.toISOString();
  if (wasOffered) offerNextMockWaitlist(entry.eventId, now);
  return withWaitlistPosition(entry);
}

export const mockCheckIns: CheckIn[] = [];

let mockCheckInSeq = 0;

export function resetMockCheckIns(): void {
  mockCheckIns.length = 0;
  mockCheckInSeq = 0;
}

/** Check-in of a user for an event, or null (mock state for the event page button). */
export function checkInFor(userId: string, eventId: string): CheckIn | null {
  return mockCheckIns.find((item) => item.userId === userId && item.eventId === eventId) ?? null;
}

/** Creates an in-memory check-in for exactly one known event or place, idempotent per target; "no_target"/"invalid" map to 404/400 in the interceptor. */
export function createMockCheckIn(userId: string, payload: { eventId?: string; placeId?: string }): CheckIn | "no_target" | "invalid" {
  if (userId === "" || (payload.eventId === undefined) === (payload.placeId === undefined)) return "invalid";
  const known = payload.eventId !== undefined ? mockEvents.some((item) => item.id === payload.eventId) : mockPlaces.some((item) => item.id === payload.placeId);
  if (!known) return "no_target";
  const existing = mockCheckIns.find((item) => item.userId === userId && item.eventId === (payload.eventId ?? null) && item.placeId === (payload.placeId ?? null));
  if (existing) return existing;
  mockCheckInSeq += 1;
  const checkIn: CheckIn = { id: `60000000-0000-4000-8000-${String(mockCheckInSeq).padStart(12, "0")}`, userId, eventId: payload.eventId ?? null, placeId: payload.placeId ?? null, checkedInAt: new Date().toISOString() };
  mockCheckIns.push(checkIn);
  return checkIn;
}

/**
 * How many people already stand in the queue (макет, экран 18, «Встать в лист ожидания · 7 впереди»).
 * GET /waitlist/me answers a position only to the person holding an entry, so nobody can see the
 * length of the queue before joining it (#496); this is the number that endpoint will report.
 */
export function waitlistAheadCount(eventId: string): number {
  refreshMockWaitlist(eventId);
  return waitlistQueue(eventId).length;
}

export function remainingSeats(eventId: string): number | null {
  const target = mockEvents.find((item) => item.id === eventId);
  if (!target || target.capacity === null) return null;
  refreshMockWaitlist(eventId);
  const taken = mockBookings.filter((booking) => booking.eventId === eventId && booking.status === "active").length + mockWaitlist.filter((entry) => entry.eventId === eventId && entry.status === "offered").length;
  return target.capacity - taken;
}
