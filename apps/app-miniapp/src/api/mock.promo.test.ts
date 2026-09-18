import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, MOCK_EARLY_ACCESS_EVENT_ID, MOCK_PROMO_CODE, MOCK_SINGLE_USE_PROMO_CODE, mockEvents, resetMockBookings, resetMockPromo } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "a0000000-0000-4000-8000-000000000002";

describe("promotion placements and targeted collections", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  const client = () => new ApiClient("/api");

  it("serves placements with promoted banners, a pin and boosted ids", async () => {
    restore = installMockApi();
    const placements = await client().getPromotionPlacements();

    expect(placements.banners.length).toBeGreaterThanOrEqual(1);
    expect(placements.banners.every((event) => event.promoted)).toBe(true);
    expect(placements.pins).toHaveLength(1);
    expect(placements.pins[0].event.promoted).toBe(true);
    expect(placements.pins[0].place.id).toBe(mockEvents[2].placeId);
    expect(placements.boostedEventIds.length).toBeGreaterThanOrEqual(1);
  });

  it("serves a targeted collection with an explanation derived from the mock visit history", async () => {
    restore = installMockApi();
    const targeted = await client().getTargetedPromotions();

    expect(targeted.collections).toHaveLength(1);
    const row = targeted.collections[0];
    expect(row.campaign.type).toBe("target_collection");
    expect(row.event.id).toBe(row.campaign.eventId);
    expect(row.explanation).toContain("посещени");
    expect(row.explanation).toContain("афиша");
  });
});

describe("promo code booking flow", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockBookings();
    resetMockPromo();
  });

  const client = () => new ApiClient("/api");

  it("rejects booking an early-access event without a code (403, backend parity)", async () => {
    restore = installMockApi();
    await expect(client().createBooking({ userId: DEMO_USER_ID, eventId: MOCK_EARLY_ACCESS_EVENT_ID })).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });

  it("books the early-access event with a valid promo code", async () => {
    restore = installMockApi();
    const api = client();

    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: MOCK_EARLY_ACCESS_EVENT_ID, promoCode: MOCK_PROMO_CODE });
    expect(booking.status).toBe("active");

    const details = await api.getEventDetails(MOCK_EARLY_ACCESS_EVENT_ID, DEMO_USER_ID);
    expect(details.activeBookingId).toBe(booking.id);
  });

  it("rejects an unknown promo code (403)", async () => {
    restore = installMockApi();
    await expect(client().createBooking({ userId: DEMO_USER_ID, eventId: MOCK_EARLY_ACCESS_EVENT_ID, promoCode: "NOPE" })).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });

  it("rejects an exhausted promo code (403)", async () => {
    restore = installMockApi();
    const api = client();

    const first = await api.createBooking({ userId: DEMO_USER_ID, eventId: MOCK_EARLY_ACCESS_EVENT_ID, promoCode: MOCK_SINGLE_USE_PROMO_CODE });
    expect(first.status).toBe("active");

    await expect(api.createBooking({ userId: OTHER_USER_ID, eventId: MOCK_EARLY_ACCESS_EVENT_ID, promoCode: MOCK_SINGLE_USE_PROMO_CODE })).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });

  it("books a regular event without any code", async () => {
    restore = installMockApi();
    const target = mockEvents.find((item) => item.id !== MOCK_EARLY_ACCESS_EVENT_ID && item.capacity !== null)!;
    const booking = await client().createBooking({ userId: DEMO_USER_ID, eventId: target.id });

    expect(booking.status).toBe("active");
  });
});
