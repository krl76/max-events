// START_MODULE_CONTRACT
// PURPOSE: Mock organizer store: the event and place panel with its drafts, the sales and stats reports, the organizer ratings, the promo surface and the page-view counter.
// SCOPE: Organizer state and its reports; the HTTP surface is in ./organizer.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - recordMockPageView - Records a page view with per-user per-target per-day dedup (backend StatsService.recordView 23505 parity); the mock has no auth token, so the viewer is the demo user
// - MOCK_ORGANIZER_PAID_EVENT_ID - seeded published paid organizer event with two frozen sales, one cancellation and four views (re-seeded idempotently by resetMockOrganizer)
// - resetMockOrganizer - restore the seeded organizer drafts (test isolation)
// - organizerEvents - Backend EventsService.listMine parity: the demo user's events (drafts included), startsAt ASC then id ASC
// - organizerPlaces - Backend PlacesService.listMine parity: the demo user's places (drafts included), title ASC then id ASC
// - createMockOrganizerEvent - Backend organizer create parity: the payload is CreateEventSchema-validated by the interceptor; the draft belongs to the demo user
// - createMockOrganizerPlace - Backend organizer create parity for places
// - publishMockOrganizerEvent - Backend organizer publish parity: 404 unknown, 403 when the id is a catalog event not owned by the demo user (ownership emulation), otherwise flips the flag
// - publishMockOrganizerPlace - shared with organizer.routes
// - updateMockOrganizerEvent - Backend EventsService.update parity: whitelist patch, merged EventSchema validation; 404 unknown, 403 catalog (not owned)
// - updateMockOrganizerPlace - Backend PlacesService.update parity: CreatePlaceSchema.partial() patch; 404 unknown, 403 catalog (not owned)
// - mockStatsPeriod - Backend parseStatsPeriod parity: from/to query values into a period, or null when the window is inverted
// - mockOrganizerEventStats - Backend StatsService.eventStats parity: views/bookings/cancellations/paid counters for an owned event over a period; "forbidden" for catalog events, null when unknown
// - mockEventSalesReport - Backend PaymentsService.salesReport parity: only succeeded payments with the frozen commission made inside the period make the report; null (404) for unknown and foreign events alike
// - mockOrganizerRating - Backend buildOrganizerRating parity: the catalog fixture organizer owns all catalog events (same convention as eventDetails), the demo user owns the organizer-panel events; null below MIN_REVIEWS, onTimePercent null without past events
// - mockEventOrganizerRating - Backend RatingService.forEvent parity: null (404) for unknown or unpublished events; the rating of the event owner otherwise
// - resetMockCampaigns - clear in-memory promo campaigns (test isolation)
// - listMockCampaigns - Backend PromoService.listCampaigns parity: createdAt ASC
// - createMockCampaign - Backend PromoService.createCampaign parity: uppercased code, duplicate code per event -> "duplicate" (409)
// - resetMockPromotions - clear in-memory promotion campaigns (test isolation)
// - listMockPromotions - Backend PromotionService.list parity: startsAt ASC then id ASC, with lazy expiry
// - createMockPromotion - Backend PromotionService.create parity: a campaign already past its window is created completed; the payload refines (period, audience) are validated by the interceptor
// - payMockPromotion - Backend PromotionService.recordPayment parity: manual paid stamp; "no_campaign" when the campaign is not on this event
// - resetMockPromoCodes - clear in-memory promocodes (test isolation)
// - listMockPromoCodes - Backend PromoService.list parity: createdAt ASC
// - createMockPromoCode - Backend PromoService.create parity: uppercased code, duplicate code per event -> "duplicate" (409)
// - setMockEarlyAccess - Backend PromoService.setEarlyAccess parity: sets the owned event's booking window
// - MOCK_ORGANIZER_BASELINE - the seven-day demo baseline of the organizer summary; nothing on the backend counts bookings per weekday or attributes traffic yet
// - resetMockOrganizerDay - clear the event-day state the mock owns alone (options, check-ins, waitlist offers)
// - mockOrganizerSummary - mock GET /organizer/summary: the demo baseline plus the store's own organizer bookings, the attendance split and the traffic shares
// - mockOrganizerEventOptions - mock GET /organizer/events/:id/options: the four экран 46 switches, defaulted on first read
// - updateMockOrganizerEventOptions - mock PATCH of the same sub-resource
// - mockOrganizerAttendance - mock GET /organizer/events/:id/attendance: counters, the roster built from the store's bookings, the seeded waitlist and the venue slots
// - checkInMockOrganizerGuest - mock POST /organizer/events/:id/check-ins: mark a booking arrived by its entry code
// - inviteMockOrganizerWaitlist - mock POST /organizer/events/:id/waitlist/invites: offer the freed seats to the head of the waitlist
// - resetMockOrganizerSetup - clear the настройка state of экран 44 (test isolation and the «первый заход» case of a browser pass)
// - mockOrganizerSetup - mock GET /organizer/setup: the seeded venue card of макета (parity with OrganizationsService.getSetup)
// - updateMockOrganizerSetup - mock PATCH /organizer/setup: merges the patch, refusing a payment link the Event contract would refuse
// - completeMockOrganizerSetup - mock POST /organizer/setup/complete: idempotent completedAt stamp
// END_MODULE_MAP

import { CreatePlaceSchema, EventSchema, StatsPeriodSchema } from "@max-events/api-contracts";
import type { Booking, CreateEvent, CreatePlace, CreatePromoCampaignWrite, CreatePromoCodeWrite, CreatePromotionWrite, Event, EventSalesReport, OrganizerEventStats, OrganizerRating, OrganizerRatingResponse, PageViewTarget, Payment, Place, PromoCampaign, PromoCode, PromotionCampaign, RecordPageViewWrite, StatsPeriod } from "@max-events/api-contracts";
import { ORGANIZER_ACTIVITIES, ORGANIZER_PAYOUT_MODES, ORGANIZER_SETUP_STEPS, organizerEntryCode, type OrganizerAttendance, type OrganizerEventOptions, type OrganizerParticipant, type OrganizerSetup, type OrganizerSlot, type OrganizerSummary, type OrganizerWaitlistEntry, type UpdateOrganizerEventOptions, type UpdateOrganizerSetup } from "../client";
import { MOCK_COMMISSION_BPS, mockBookings, mockCheckIns, mockPayments } from "./bookings";

import { PLACE_STAMP, event, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockOrganization, mockOrganizers, mockPlaces, moscowDateKey, place } from "./fixtures";
import { mockReviews } from "./reviews";

interface MockPageView {
  userId: string;
  targetType: PageViewTarget;
  targetId: string;
  viewedOn: string;
}

const mockPageViews: MockPageView[] = [];

/** Records a page view with per-user per-target per-day dedup (backend StatsService.recordView 23505 parity); the mock has no auth token, so the viewer is the demo user. */
export function recordMockPageView(userId: string, payload: RecordPageViewWrite, now: Date = new Date()): { recorded: boolean } {
  const viewedOn = moscowDateKey(now.toISOString());
  if (mockPageViews.some((view) => view.userId === userId && view.targetType === payload.targetType && view.targetId === payload.targetId && view.viewedOn === viewedOn)) return { recorded: false };
  mockPageViews.push({ userId, targetType: payload.targetType, targetId: payload.targetId, viewedOn });
  return { recorded: true };
}

/** Organizer panel store item: the contract entity plus the published flag the backend keeps server-side (organizer DTOs omit it; the mock surfaces it so the client can badge drafts). */
type MockOrganizerEvent = Event & { published: boolean };

type MockOrganizerPlace = Place & { published: boolean };

/** Seeded published paid organizer event (#196/#206 demo + tests): two frozen ticket sales, one cancelled booking and seeded views are attached by seedMockOrganizerAddons. */
export const MOCK_ORGANIZER_PAID_EVENT_ID = "c00000f2-0000-4000-8000-0000000000f2";

function seedMockOrganizer(): { events: MockOrganizerEvent[]; places: MockOrganizerPlace[] } {
  return {
    events: [
      { ...event({ id: "c00000f1-0000-4000-8000-0000000000f1", title: "Акустический вечер в «Депо»", category: "afisha", city: "Москва", startsAt: "2026-10-11T19:00:00+03:00", isPaid: false, priceRub: null, capacity: 40 }), published: false },
      { ...event({ id: MOCK_ORGANIZER_PAID_EVENT_ID, title: "Квиз «Мозгобойня»", category: "afisha", city: "Москва", startsAt: "2026-09-06T19:00:00+03:00", isPaid: true, priceRub: 500, paymentUrl: "https://tickets.example.com/mozgoboynya", capacity: 60 }), published: true },
    ],
    places: [{ ...place({ id: "b00000f1-0000-4000-8000-0000000000f1", title: "Лофт на Бауманской", address: "ул. Бауманская, 5", city: "Москва", category: "other", latitude: 55.7717, longitude: 37.6879 }), published: false }],
  };
}

let mockOrganizerState = seedMockOrganizer();

let mockOrganizerSeq = 0;

/** Restore the seeded organizer drafts plus the seeded sales/views addon fixtures (test isolation). */
export function resetMockOrganizer(): void {
  mockOrganizerState = seedMockOrganizer();
  mockOrganizerSeq = 0;
  seedMockOrganizerAddons();
  resetMockOrganizerDay();
}

const MOCK_ADDON_BOOKING_IDS = ["e00000f2-0000-4000-8000-0000000000f1", "e00000f2-0000-4000-8000-0000000000f2", "e00000f2-0000-4000-8000-0000000000f3"];

const MOCK_ADDON_PAYMENT_IDS = ["700000f2-0000-4000-8000-0000000000f1", "700000f2-0000-4000-8000-0000000000f2"];

/** Seeded addon fixtures for the paid organizer event (fixed ids, re-added idempotently): two settled sales with the commission frozen (backend webhook freeze parity), one cancelled booking, four page views on a fixed past day (never dedup-collides with the test "today"). */
function seedMockOrganizerAddons(): void {
  for (let index = mockBookings.length - 1; index >= 0; index -= 1) {
    if (MOCK_ADDON_BOOKING_IDS.includes(mockBookings[index].id)) mockBookings.splice(index, 1);
  }
  for (let index = mockPayments.length - 1; index >= 0; index -= 1) {
    if (MOCK_ADDON_PAYMENT_IDS.includes(mockPayments[index].id)) mockPayments.splice(index, 1);
  }
  for (let index = mockPageViews.length - 1; index >= 0; index -= 1) {
    if (mockPageViews[index].targetId === MOCK_ORGANIZER_PAID_EVENT_ID) mockPageViews.splice(index, 1);
  }
  const saleBooking = (id: string, userId: string, status: Booking["status"]): Booking => ({ id, userId, eventId: MOCK_ORGANIZER_PAID_EVENT_ID, status, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
  mockBookings.push(saleBooking(MOCK_ADDON_BOOKING_IDS[0], mockFriendIds[0], "active"), saleBooking(MOCK_ADDON_BOOKING_IDS[1], mockFriendIds[1], "active"), saleBooking(MOCK_ADDON_BOOKING_IDS[2], mockFriendIds[2], "cancelled"));
  const frozenSale = (id: string, bookingId: string): Payment => ({ id, bookingId, providerPaymentId: `pay_sandbox_${bookingId}`, status: "succeeded", amountRub: 500, currency: "RUB", description: "Билет: Квиз «Мозгобойня»", commissionRub: 50, netRub: 450, commissionBps: MOCK_COMMISSION_BPS, commissionFixedAt: PLACE_STAMP, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
  mockPayments.push(frozenSale(MOCK_ADDON_PAYMENT_IDS[0], MOCK_ADDON_BOOKING_IDS[0]), frozenSale(MOCK_ADDON_PAYMENT_IDS[1], MOCK_ADDON_BOOKING_IDS[1]));
  for (const viewer of mockFriendIds.slice(0, 4)) mockPageViews.push({ userId: viewer, targetType: "event", targetId: MOCK_ORGANIZER_PAID_EVENT_ID, viewedOn: "2026-08-01" });
}
seedMockOrganizerAddons();

/** Backend EventsService.listMine parity: the demo user's events (drafts included), startsAt ASC then id ASC. */
export function organizerEvents(): MockOrganizerEvent[] {
  return [...mockOrganizerState.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Backend PlacesService.listMine parity: the demo user's places (drafts included), title ASC then id ASC. */
export function organizerPlaces(): MockOrganizerPlace[] {
  return [...mockOrganizerState.places].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/** Backend organizer create parity: the payload is CreateEventSchema-validated by the interceptor; the draft belongs to the demo user. */
export function createMockOrganizerEvent(payload: CreateEvent): MockOrganizerEvent {
  mockOrganizerSeq += 1;
  const created: MockOrganizerEvent = { ...payload, id: `f1000000-0000-4000-8000-${String(mockOrganizerSeq).padStart(12, "0")}`, chatLink: null, promoted: false, published: false, bookingOpensAt: null, weather: null };
  mockOrganizerState.events.push(created);
  return created;
}

/** Backend organizer create parity for places. */
export function createMockOrganizerPlace(payload: CreatePlace): MockOrganizerPlace {
  mockOrganizerSeq += 1;
  const created: MockOrganizerPlace = { ...payload, id: `f2000000-0000-4000-8000-${String(mockOrganizerSeq).padStart(12, "0")}`, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP, published: false, logoUrl: payload.logoUrl ?? null };
  mockOrganizerState.places.push(created);
  return created;
}

/** Backend organizer publish parity: 404 unknown, 403 when the id is a catalog event not owned by the demo user (ownership emulation), otherwise flips the flag. */
export function publishMockOrganizerEvent(id: string): MockOrganizerEvent | "forbidden" | null {
  const found = mockOrganizerState.events.find((item) => item.id === id);
  if (!found) return mockEvents.some((item) => item.id === id) ? "forbidden" : null;
  found.published = true;
  return found;
}

export function publishMockOrganizerPlace(id: string): MockOrganizerPlace | "forbidden" | null {
  const found = mockOrganizerState.places.find((item) => item.id === id);
  if (!found) return mockPlaces.some((item) => item.id === id) ? "forbidden" : null;
  found.published = true;
  return found;
}

/** Backend pickEventFields parity. */
const MOCK_EVENT_PATCH_KEYS = ["title", "description", "category", "city", "placeId", "startsAt", "endsAt", "isPaid", "priceRub", "paymentUrl", "capacity"] as const;

/** Backend EventsService.update parity: whitelist patch, merged EventSchema validation; 404 unknown, 403 catalog (not owned). */
export function updateMockOrganizerEvent(id: string, patch: Record<string, unknown>): MockOrganizerEvent | "forbidden" | "invalid" | null {
  const found = mockOrganizerState.events.find((item) => item.id === id);
  if (!found) return mockEvents.some((item) => item.id === id) ? "forbidden" : null;
  const picked: Record<string, unknown> = {};
  for (const key of MOCK_EVENT_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) picked[key] = patch[key];
  }
  const merged = EventSchema.safeParse({ ...found, ...picked });
  if (!merged.success || (merged.data.endsAt !== null && new Date(merged.data.endsAt) < new Date(merged.data.startsAt))) return "invalid";
  Object.assign(found, picked);
  return found;
}

/** Backend PlacesService.update parity: CreatePlaceSchema.partial() patch; 404 unknown, 403 catalog (not owned). */
export function updateMockOrganizerPlace(id: string, patch: Record<string, unknown>): MockOrganizerPlace | "forbidden" | "invalid" | null {
  const found = mockOrganizerState.places.find((item) => item.id === id);
  if (!found) return mockPlaces.some((item) => item.id === id) ? "forbidden" : null;
  const parsed = CreatePlaceSchema.partial().safeParse(patch);
  if (!parsed.success) return "invalid";
  Object.assign(found, parsed.data);
  return found;
}

/** Ownership emulation for the organizer sub-resources: the demo user's event, "forbidden" for a catalog event owned by someone else, null when unknown (backend requireOwnedEvent parity). */
function mockOwnedEvent(eventId: string): MockOrganizerEvent | "forbidden" | null {
  const own = mockOrganizerState.events.find((item) => item.id === eventId);
  if (own) return own;
  return mockEvents.some((item) => item.id === eventId) ? "forbidden" : null;
}

const ALL_TIME: StatsPeriod = { from: null, to: null };

/** Backend StatsService.inPeriod parity: an inclusive window, null on either side meaning open-ended. */
function mockInPeriod(at: string, period: StatsPeriod): boolean {
  const time = new Date(at).getTime();
  if (period.from !== null && time < new Date(period.from).getTime()) return false;
  if (period.to !== null && time > new Date(period.to).getTime()) return false;
  return true;
}

/** Backend parseStatsPeriod parity: from/to query values into a period, or null when the window is inverted. */
export function mockStatsPeriod(url: URL): StatsPeriod | null {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const parsed = StatsPeriodSchema.safeParse({ from: from === null || from === "" ? null : from, to: to === null || to === "" ? null : to });
  return parsed.success ? parsed.data : null;
}

/** Backend StatsService.eventStats parity: views/bookings/cancellations/paid counters for an owned event over a period; "forbidden" for catalog events, null when unknown. */
export function mockOrganizerEventStats(eventId: string, period: StatsPeriod = ALL_TIME): OrganizerEventStats | "forbidden" | null {
  const own = mockOwnedEvent(eventId);
  if (own === null || own === "forbidden") return own;
  const bookings = mockBookings.filter((booking) => booking.eventId === eventId && mockInPeriod(booking.createdAt, period));
  return {
    eventId,
    period,
    views: mockPageViews.filter((view) => view.targetType === "event" && view.targetId === eventId && mockInPeriod(view.viewedOn, period)).length,
    bookings: bookings.length,
    cancellations: bookings.filter((booking) => booking.status === "cancelled").length,
    paidBookings: own.isPaid ? bookings.filter((booking) => booking.status === "active").length : 0,
  };
}

/** Backend PaymentsService.salesReport parity: only succeeded payments with the frozen commission made inside the period make the report; null (404) for unknown and foreign events alike. */
export function mockEventSalesReport(eventId: string, period: StatsPeriod = ALL_TIME): EventSalesReport | null {
  if (!mockOrganizerState.events.some((item) => item.id === eventId)) return null;
  const bookingIds = new Set(mockBookings.filter((booking) => booking.eventId === eventId).map((booking) => booking.id));
  const frozen = mockPayments.filter((payment) => bookingIds.has(payment.bookingId) && payment.status === "succeeded" && payment.commissionFixedAt !== null && payment.commissionRub !== null && payment.netRub !== null && payment.commissionBps !== null && mockInPeriod(payment.createdAt, period)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
  return {
    eventId,
    period,
    rows: frozen.map((payment) => ({ paymentId: payment.id, bookingId: payment.bookingId, status: payment.status, grossRub: payment.amountRub, commissionRub: payment.commissionRub!, netRub: payment.netRub!, commissionBps: payment.commissionBps!, commissionFixedAt: payment.commissionFixedAt! })),
    grossRub: frozen.reduce((sum, payment) => sum + payment.amountRub, 0),
    commissionRub: frozen.reduce((sum, payment) => sum + (payment.commissionRub ?? 0), 0),
    netRub: frozen.reduce((sum, payment) => sum + (payment.netRub ?? 0), 0),
    provider: "sandbox",
  };
}

/** Backend MIN_REVIEWS parity: the rating card hides below this review count. */
const MOCK_MIN_RATING_REVIEWS = 3;

const MOCK_ON_TIME_BEFORE_MS = 30 * 60 * 1000;

const MOCK_ON_TIME_AFTER_MS = 15 * 60 * 1000;

/** Backend buildOrganizerRating parity: the catalog fixture organizer owns all catalog events (same convention as eventDetails), the demo user owns the organizer-panel events; null below MIN_REVIEWS, onTimePercent null without past events. */
export function mockOrganizerRating(userId: string, now: Date = new Date()): OrganizerRatingResponse {
  const owned: Event[] = userId === mockOrganizers[0].id ? mockEvents : userId === mockDemoUser.id ? mockOrganizerState.events : [];
  const ownedIds = new Set(owned.map((item) => item.id));
  const reviews = mockReviews.filter((item) => item.eventId !== null && ownedIds.has(item.eventId));
  if (reviews.length < MOCK_MIN_RATING_REVIEWS) return { rating: null };
  const checkIns = mockCheckIns.filter((item) => item.eventId !== null && ownedIds.has(item.eventId));
  const past = owned.filter((item) => item.published !== false && new Date(item.startsAt).getTime() <= now.getTime());
  let onTimePercent: number | null = null;
  if (past.length > 0) {
    const onTime = past.filter((item) =>
      checkIns.some((checkIn) => {
        if (checkIn.eventId !== item.id) return false;
        const delta = new Date(checkIn.checkedInAt).getTime() - new Date(item.startsAt).getTime();
        return delta >= -MOCK_ON_TIME_BEFORE_MS && delta <= MOCK_ON_TIME_AFTER_MS;
      }),
    ).length;
    onTimePercent = (onTime / past.length) * 100;
  }
  const rating: OrganizerRating = {
    organizerUserId: userId,
    averageStars: reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length,
    recommendPercent: (reviews.filter((item) => item.wouldGoAgain).length / reviews.length) * 100,
    visitsCount: checkIns.length,
    onTimePercent,
    reviewsCount: reviews.length,
    // Attendance needs bookings against check-ins per event; the mock has no such ledger, so it stays unknown like a fresh backend row.
    attendancePercent: null,
    eventsCount: owned.filter((item) => item.published !== false).length,
  };
  return { rating };
}

/** Backend RatingService.forEvent parity: null (404) for unknown or unpublished events; the rating of the event owner otherwise. */
export function mockEventOrganizerRating(eventId: string, now: Date = new Date()): OrganizerRatingResponse | null {
  const catalogEvent = mockEvents.find((item) => item.id === eventId);
  if (catalogEvent) return catalogEvent.published === false ? null : mockOrganizerRating(mockOrganizers[0].id, now);
  const ownEvent = mockOrganizerState.events.find((item) => item.id === eventId);
  if (!ownEvent || ownEvent.published === false) return null;
  return mockOrganizerRating(mockDemoUser.id, now);
}

const mockPromoCampaigns: PromoCampaign[] = [];

let mockCampaignSeq = 0;

export function resetMockCampaigns(): void {
  mockPromoCampaigns.length = 0;
  mockCampaignSeq = 0;
}

/** Backend PromoService.listCampaigns parity: createdAt ASC. */
export function listMockCampaigns(eventId: string): PromoCampaign[] | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  return mockPromoCampaigns.filter((campaign) => campaign.eventId === eventId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Backend PromoService.createCampaign parity: uppercased code, duplicate code per event -> "duplicate" (409). */
export function createMockCampaign(eventId: string, payload: CreatePromoCampaignWrite, now: Date = new Date()): PromoCampaign | "forbidden" | "invalid" | "duplicate" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const code = payload.code.trim().toUpperCase();
  const title = payload.title.trim();
  if (code === "" || code.length > 40 || title === "") return "invalid";
  if (mockPromoCampaigns.some((campaign) => campaign.eventId === eventId && campaign.code === code)) return "duplicate";
  mockCampaignSeq += 1;
  const campaign: PromoCampaign = { id: `f3000000-0000-4000-8000-${String(mockCampaignSeq).padStart(12, "0")}`, eventId, type: payload.type, status: "active", code, title, maxFulfillments: payload.maxFulfillments ?? null, fulfillmentCount: 0, createdAt: now.toISOString(), completedAt: null };
  mockPromoCampaigns.push(campaign);
  return campaign;
}

const mockPromotionCampaigns: PromotionCampaign[] = [];

let mockPromotionSeq = 0;

export function resetMockPromotions(): void {
  mockPromotionCampaigns.length = 0;
  mockPromotionSeq = 0;
}

/** Backend expireOverdue parity: an active campaign past its endsAt flips to completed. */
function expireMockPromotions(now: Date): void {
  for (const campaign of mockPromotionCampaigns) {
    if (campaign.status !== "active" || new Date(campaign.endsAt).getTime() > now.getTime()) continue;
    campaign.status = "completed";
    campaign.completedAt = campaign.endsAt;
  }
}

/** Backend PromotionService.list parity: startsAt ASC then id ASC, with lazy expiry. */
export function listMockPromotions(eventId: string, now: Date = new Date()): PromotionCampaign[] | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  expireMockPromotions(now);
  return mockPromotionCampaigns.filter((campaign) => campaign.eventId === eventId).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Backend PromotionService.create parity: a campaign already past its window is created completed; the payload refines (period, audience) are validated by the interceptor. */
export function createMockPromotion(eventId: string, payload: CreatePromotionWrite, now: Date = new Date()): PromotionCampaign | "forbidden" | "invalid" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  if (new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) return "invalid";
  if (payload.type === "target_collection" && payload.audience == null) return "invalid";
  const tariffCode = payload.tariffCode.trim();
  if (tariffCode === "") return "invalid";
  const expired = new Date(payload.endsAt).getTime() <= now.getTime();
  mockPromotionSeq += 1;
  const campaign: PromotionCampaign = { id: `f4000000-0000-4000-8000-${String(mockPromotionSeq).padStart(12, "0")}`, eventId, type: payload.type, status: expired ? "completed" : "active", startsAt: payload.startsAt, endsAt: payload.endsAt, tariffCode, priceRub: payload.priceRub, paidAt: null, audience: payload.audience ?? null, createdAt: now.toISOString(), completedAt: expired ? payload.endsAt : null };
  mockPromotionCampaigns.push(campaign);
  return campaign;
}

/** Backend PromotionService.recordPayment parity: manual paid stamp; "no_campaign" when the campaign is not on this event. */
export function payMockPromotion(eventId: string, campaignId: string, paidAt: string | undefined, now: Date = new Date()): PromotionCampaign | "forbidden" | "no_campaign" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const campaign = mockPromotionCampaigns.find((item) => item.id === campaignId && item.eventId === eventId);
  if (!campaign) return "no_campaign";
  expireMockPromotions(now);
  campaign.paidAt = paidAt ?? now.toISOString();
  return campaign;
}

const mockOrganizerPromoCodes: PromoCode[] = [];

let mockPromoCodeSeq = 0;

export function resetMockPromoCodes(): void {
  mockOrganizerPromoCodes.length = 0;
  mockPromoCodeSeq = 0;
}

/** Backend PromoService.list parity: createdAt ASC. */
export function listMockPromoCodes(eventId: string): PromoCode[] | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  return mockOrganizerPromoCodes.filter((code) => code.eventId === eventId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Backend PromoService.create parity: uppercased code, duplicate code per event -> "duplicate" (409). */
export function createMockPromoCode(eventId: string, payload: CreatePromoCodeWrite, now: Date = new Date()): PromoCode | "forbidden" | "invalid" | "duplicate" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const code = payload.code.trim().toUpperCase();
  if (code === "" || code.length > 40) return "invalid";
  if (mockOrganizerPromoCodes.some((item) => item.eventId === eventId && item.code === code)) return "duplicate";
  mockPromoCodeSeq += 1;
  const created: PromoCode = { id: `f2000000-0000-4000-8000-${String(mockPromoCodeSeq).padStart(12, "0")}`, eventId, code, maxRedemptions: payload.maxRedemptions ?? null, redeemedCount: 0, expiresAt: payload.expiresAt ?? null, createdAt: now.toISOString() };
  mockOrganizerPromoCodes.push(created);
  return created;
}

/**
 * «Активные кампании» экрана 48 читаются из трёх настоящих эндпоинтов, а таблицы за ними пустые:
 * без строки-другой раздел живёт только пустым состоянием и макет по нему не проверить. Сеется один
 * раз при загрузке модуля, а не из resetMockOrganizer, чтобы resetMockPromotions/resetMockPromoCodes
 * остались тем, чем их считают тесты, — способом получить чистые таблицы.
 */
function seedMockPromoDemo(now: Date = new Date()): void {
  mockPromotionCampaigns.push({
    id: "f4000000-0000-4000-8000-0000000000d1",
    eventId: MOCK_ORGANIZER_PAID_EVENT_ID,
    type: "boost",
    status: "active",
    startsAt: new Date(now.getTime() - 10 * 3_600_000).toISOString(),
    endsAt: new Date(now.getTime() + 14 * 3_600_000).toISOString(),
    tariffCode: "boost-24h",
    priceRub: 0,
    paidAt: null,
    audience: null,
    createdAt: new Date(now.getTime() - 10 * 3_600_000).toISOString(),
    completedAt: null,
  });
  mockOrganizerPromoCodes.push({ id: "f2000000-0000-4000-8000-0000000000d1", eventId: MOCK_ORGANIZER_PAID_EVENT_ID, code: "ОСЕНЬ20", maxRedemptions: null, redeemedCount: 47, expiresAt: null, createdAt: PLACE_STAMP });
}
seedMockPromoDemo();

/** Backend PromoService.setEarlyAccess parity: sets the owned event's booking window. */
export function setMockEarlyAccess(eventId: string, bookingOpensAt: string): { bookingOpensAt: string } | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  owned.bookingOpensAt = bookingOpensAt;
  return { bookingOpensAt };
}

/**
 * Nothing on the backend buckets bookings by weekday or attributes where a guest came from, so the
 * summary of экраны 45 и 48 rides a fixed demo baseline (Monday first). The store's own organizer
 * bookings are added on top, so the screens still move when something is actually booked here.
 */
export const MOCK_ORGANIZER_BASELINE = { byWeekday: [18, 26, 22, 37, 48, 61, 33], previousBookings: 208, sources: [62, 24, 14], attended: 228, cancelled: 10 } as const;

const MOCK_TRAFFIC_SOURCES = ["chats", "feed", "search"] as const;

/** Monday-first index of an ISO instant, matching the пн…вс order of the histogram. */
function mondayFirstIndex(at: string): number {
  return (new Date(at).getDay() + 6) % 7;
}

/** Mock GET /organizer/summary: the demo baseline plus the organizer's own bookings over the period. */
export function mockOrganizerSummary(period: StatsPeriod = ALL_TIME): OrganizerSummary {
  const ownedIds = new Set(mockOrganizerState.events.map((item) => item.id));
  const bookings = mockBookings.filter((booking) => ownedIds.has(booking.eventId) && mockInPeriod(booking.createdAt, period));
  const byWeekday = [...MOCK_ORGANIZER_BASELINE.byWeekday];
  for (const booking of bookings) byWeekday[mondayFirstIndex(booking.createdAt)] += 1;
  const total = byWeekday.reduce((sum, value) => sum + value, 0);
  // Доли считаются от того же ряда, что и число записей: иначе две брони стора дали бы «0% пришли» на фоне 248 записей.
  const cancelled = MOCK_ORGANIZER_BASELINE.cancelled + bookings.filter((booking) => booking.status === "cancelled").length;
  const attended = MOCK_ORGANIZER_BASELINE.attended + mockCheckIns.filter((item) => item.eventId !== null && ownedIds.has(item.eventId)).length;
  const previous: number = MOCK_ORGANIZER_BASELINE.previousBookings;
  return {
    bookings: total,
    bookingsDeltaPercent: previous === 0 ? null : Math.round(((total - previous) / previous) * 100),
    attendedPercent: total === 0 ? null : Math.round((attended / total) * 100),
    cancelledPercent: total === 0 ? null : Math.round((cancelled / total) * 100),
    byWeekday,
    sources: MOCK_TRAFFIC_SOURCES.map((source, index) => ({ source, percent: MOCK_ORGANIZER_BASELINE.sources[index] })),
  };
}

const mockEventOptions = new Map<string, OrganizerEventOptions>();

/** Guests a booking brings along: no column carries them, so the mock derives a stable 0..1 from the id. */
function mockGuests(id: string): number {
  return id.charCodeAt(id.length - 1) % 2;
}

function mockOrganizerName(userId: string): string {
  return mockFriends.find((friend) => friend.id === userId)?.name ?? "Участник";
}

/** Who is waiting for a seat. The waitlist store lives in the bookings domain and holds only the viewer's own entry, so the organizer view of it is seeded here, deterministically per event. */
function seedMockWaitlist(eventId: string): OrganizerWaitlistEntry[] {
  return mockFriendIds.slice(3, 6).map((userId, index) => ({ entryId: `${eventId.slice(0, 8)}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, userId, name: mockOrganizerName(userId), guests: mockGuests(userId), joinedAt: new Date(new Date(PLACE_STAMP).getTime() + index * 3_600_000).toISOString() }));
}

const mockCheckedInAt = new Map<string, string>();

const mockInvitedFromWaitlist = new Map<string, number>();

/** Clear the event-day state no other domain owns (options, door check-ins, waitlist offers). */
export function resetMockOrganizerDay(): void {
  mockEventOptions.clear();
  mockCheckedInAt.clear();
  mockInvitedFromWaitlist.clear();
}

/** Mock GET /organizer/events/:id/options: the экран 46 switches, defaulted the first time they are read. */
export function mockOrganizerEventOptions(eventId: string): OrganizerEventOptions | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const stored = mockEventOptions.get(eventId);
  if (stored) return stored;
  // Defaults follow what the event itself already says: a capped event takes a waitlist, a paid one
  // with an external payment link registers off-site.
  const created: OrganizerEventOptions = { eventId, waitlistEnabled: owned.capacity !== null, registrationInApp: owned.paymentUrl === null, externalUrl: owned.paymentUrl, recurrence: null };
  mockEventOptions.set(eventId, created);
  return created;
}

/** Mock PATCH /organizer/events/:id/options. */
export function updateMockOrganizerEventOptions(eventId: string, patch: UpdateOrganizerEventOptions): OrganizerEventOptions | "forbidden" | "invalid" | null {
  const current = mockOrganizerEventOptions(eventId);
  if (current === null || current === "forbidden") return current;
  if (patch.recurrence != null && (patch.recurrence.rule !== "weekly" || Number.isNaN(new Date(patch.recurrence.until).getTime()))) return "invalid";
  if (patch.registrationInApp === false && (patch.externalUrl ?? current.externalUrl) === null) return "invalid";
  const next: OrganizerEventOptions = { ...current, ...patch };
  mockEventOptions.set(eventId, next);
  return next;
}

/** The venue day of экран 47 as the design draws it: 14:00–17:00, 17:30–20:30, 21:00–23:30, in minutes from midnight. */
const MOCK_SLOT_WINDOWS = [
  [14 * 60, 17 * 60],
  [17 * 60 + 30, 20 * 60 + 30],
  [21 * 60, 23 * 60 + 30],
] as const;

/** Venue slots around the event start; the slots domain does not exist yet (#492), so the event day carries them. */
function mockSlots(start: string): OrganizerSlot[] {
  const at = new Date(start);
  // The venue day, not the event clock: the windows are the venue's, and the one the event falls into is taken.
  const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  return MOCK_SLOT_WINDOWS.map(([opens, closes], index) => {
    const from = new Date(midnight + opens * 60_000);
    const to = new Date(midnight + closes * 60_000);
    return { id: `slot-${index}`, startsAt: from.toISOString(), endsAt: to.toISOString(), busy: at.getTime() >= from.getTime() && at.getTime() < to.getTime() };
  });
}

/** Mock GET /organizer/events/:id/attendance: the roster of экран 47 built from the bookings the store already has. */
export function mockOrganizerAttendance(eventId: string): OrganizerAttendance | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const bookings = mockBookings.filter((booking) => booking.eventId === eventId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const active = bookings.filter((booking) => booking.status === "active");
  const participants: OrganizerParticipant[] = active.map((booking) => ({ bookingId: booking.id, userId: booking.userId, name: mockOrganizerName(booking.userId), guests: mockGuests(booking.id), checkedInAt: mockCheckedInAt.get(booking.id) ?? null, bookedAt: booking.createdAt }));
  const invited = mockInvitedFromWaitlist.get(eventId) ?? 0;
  const waitlist = seedMockWaitlist(eventId).slice(invited);
  const cancelled = bookings.length - active.length;
  return {
    eventId,
    capacity: owned.capacity,
    bookedCount: active.length,
    waitlistCount: waitlist.length,
    checkedInCount: participants.filter((row) => row.checkedInAt !== null).length,
    freedSeats: Math.max(cancelled - invited, 0),
    chatMessages: owned.chatLink === null ? null : active.length * 2,
    participants,
    waitlist,
    slots: mockSlots(owned.startsAt),
  };
}

/** Mock POST /organizer/events/:id/check-ins: the door marks a guest arrived by the code on their ticket. */
export function checkInMockOrganizerGuest(eventId: string, code: string, now: Date = new Date()): OrganizerParticipant | "forbidden" | "no_guest" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const wanted = code.trim().toUpperCase();
  const booking = mockBookings.find((row) => row.eventId === eventId && row.status === "active" && organizerEntryCode(row.id) === wanted);
  if (!booking) return "no_guest";
  // Идемпотентно: второй скан той же брони не сдвигает время прихода.
  const checkedInAt = mockCheckedInAt.get(booking.id) ?? now.toISOString();
  mockCheckedInAt.set(booking.id, checkedInAt);
  return { bookingId: booking.id, userId: booking.userId, name: mockOrganizerName(booking.userId), guests: mockGuests(booking.id), checkedInAt, bookedAt: booking.createdAt };
}

/** Mock POST /organizer/events/:id/waitlist/invites: never offers more seats than were actually freed. */
export function inviteMockOrganizerWaitlist(eventId: string, count: number): { invited: number } | "forbidden" | "invalid" | null {
  const attendance = mockOrganizerAttendance(eventId);
  if (attendance === null || attendance === "forbidden") return attendance;
  if (!Number.isInteger(count) || count < 1) return "invalid";
  const invited = Math.min(count, attendance.freedSeats, attendance.waitlist.length);
  mockInvitedFromWaitlist.set(eventId, (mockInvitedFromWaitlist.get(eventId) ?? 0) + invited);
  return { invited };
}

/**
 * Настройка организатора (макет, экран 44). Паритет с OrganizationsService.getSetup/updateSetup/completeSetup.
 * Переживает перезагрузку, как серверный completedAt: без этого повторный заход в панель снова
 * упирался бы в настройку.
 */
const MOCK_SETUP_KEY = "max-events.mock-organizer-setup";

let mockSetup: OrganizerSetup | null = null;

function defaultMockSetup(): OrganizerSetup {
  const venue = mockPlaces[0];
  return {
    organizationId: mockOrganization.id,
    step: "venue",
    completedAt: null,
    venue: { placeId: venue.id, title: venue.title, address: venue.address, city: venue.city },
    activities: ["events", "slots"],
    payouts: { mode: "none", paymentUrl: null, contacts: mockOrganization.contacts },
  };
}

function readStoredSetup(): OrganizerSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_SETUP_KEY);
    return raw === null ? null : (JSON.parse(raw) as OrganizerSetup);
  } catch {
    return null;
  }
}

function storeMockSetup(setup: OrganizerSetup): OrganizerSetup {
  mockSetup = setup;
  if (typeof window === "undefined") return setup;
  try {
    window.localStorage.setItem(MOCK_SETUP_KEY, JSON.stringify(setup));
  } catch {
    // Витрина без записи всё равно работает — просто до перезагрузки.
  }
  return setup;
}

/** Clear the настройка state: test isolation, and the «первый заход» case of a browser pass. */
export function resetMockOrganizerSetup(): void {
  mockSetup = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MOCK_SETUP_KEY);
  } catch {
    // Нечего чистить — значит, и не записывалось.
  }
}

/** Mock GET /organizer/setup: the seeded «Парк Горького» card макета until настройка changes it. */
export function mockOrganizerSetup(): OrganizerSetup {
  mockSetup ??= readStoredSetup() ?? defaultMockSetup();
  return mockSetup;
}

/** Backend `Event.paymentUrl` is `z.string().url()`; the mock refuses what that schema would refuse. */
function isMockUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mock PATCH /organizer/setup. Ссылку на оплату проверяет то же правило, что и у события: платный
 * режим без разбираемого URL — 400, потому что такого события `EventSchema` всё равно не примет.
 */
export function updateMockOrganizerSetup(patch: unknown): OrganizerSetup | "invalid" {
  if (typeof patch !== "object" || patch === null) return "invalid";
  const raw = patch as UpdateOrganizerSetup;
  const current = mockOrganizerSetup();
  const step = raw.step ?? current.step;
  if (!ORGANIZER_SETUP_STEPS.includes(step)) return "invalid";
  const activities = raw.activities ?? current.activities;
  if (!Array.isArray(activities) || activities.some((item) => !ORGANIZER_ACTIVITIES.includes(item))) return "invalid";
  const venue = { ...current.venue, ...raw.venue };
  if (venue.title.trim() === "") return "invalid";
  const payouts = { ...current.payouts, ...raw.payouts };
  if (!ORGANIZER_PAYOUT_MODES.includes(payouts.mode)) return "invalid";
  if (payouts.mode === "external" && (payouts.paymentUrl === null || !isMockUrl(payouts.paymentUrl))) return "invalid";
  return storeMockSetup({ ...current, step, venue, activities, payouts: payouts.mode === "none" ? { ...payouts, paymentUrl: null } : payouts });
}

/** Mock POST /organizer/setup/complete: idempotent, so a second call does not move the stamp. */
export function completeMockOrganizerSetup(now: Date = new Date()): OrganizerSetup {
  const current = mockOrganizerSetup();
  if (current.completedAt !== null) return current;
  return storeMockSetup({ ...current, step: "event", completedAt: now.toISOString() });
}
