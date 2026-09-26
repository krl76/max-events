import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiClient, trackPageView } from "./client";
import { installMockApi, MOCK_ORGANIZER_PAID_EVENT_ID, mockEvents, mockOrganizers, resetMockCampaigns, resetMockCheckIns, resetMockOrganizer, resetMockPromoCodes, resetMockPromotions } from "./mock";

const PAID_OWNED_EVENT_ID = MOCK_ORGANIZER_PAID_EVENT_ID;
const DRAFT_OWNED_EVENT_ID = "c00000f1-0000-4000-8000-0000000000f1";
const CATALOG_EVENT_ID = mockEvents[0].id;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const ORGANIZER_ID = mockOrganizers[0].id;

const FUTURE_PROMOTION = { type: "boost", startsAt: "2027-01-01T10:00:00+03:00", endsAt: "2027-01-08T10:00:00+03:00", tariffCode: "boost-7", priceRub: 990 } as const;

describe("organizer stats, sales, page views, rating and campaigns via mock", () => {
  let restore: (() => void) | null = null;

  beforeEach(() => {
    resetMockOrganizer();
    resetMockCampaigns();
    resetMockPromotions();
    resetMockPromoCodes();
    resetMockCheckIns();
  });

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockOrganizer();
    resetMockCampaigns();
    resetMockPromotions();
    resetMockPromoCodes();
    resetMockCheckIns();
  });

  const client = () => new ApiClient("/api");

  it("reports the seeded counters for an owned paid event", async () => {
    restore = installMockApi();
    const stats = await client().getOrganizerEventStats(PAID_OWNED_EVENT_ID);
    expect(stats).toMatchObject({ eventId: PAID_OWNED_EVENT_ID, views: 4, bookings: 3, cancellations: 1, paidBookings: 2 });
  });

  it("reports 403 for a catalog event owned by someone else and 404 for an unknown one", async () => {
    restore = installMockApi();
    const api = client();
    await expect(api.getOrganizerEventStats(CATALOG_EVENT_ID)).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.getOrganizerEventStats(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("builds the sales report from frozen sales only (backend salesReport parity)", async () => {
    restore = installMockApi();
    const report = await client().getEventSales(PAID_OWNED_EVENT_ID);
    expect(report.rows).toHaveLength(2);
    expect(report.grossRub).toBe(1000);
    expect(report.commissionRub).toBe(100);
    expect(report.netRub).toBe(900);
    expect(report.rows[0]).toMatchObject({ grossRub: 500, commissionRub: 50, netRub: 450, status: "succeeded" });
    expect(report.provider).toBe("sandbox");
  });

  it("returns an empty report for an owned event without sales and 404 for foreign or unknown events (backend parity: sales 404s both)", async () => {
    restore = installMockApi();
    const api = client();
    const empty = await api.getEventSales(DRAFT_OWNED_EVENT_ID);
    expect(empty.rows).toHaveLength(0);
    expect(empty.grossRub).toBe(0);
    await expect(api.getEventSales(CATALOG_EVENT_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.getEventSales(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("records a page view once per user and day (backend 23505 dedup parity)", async () => {
    restore = installMockApi();
    const api = client();

    const first = await api.recordPageView({ targetType: "event", targetId: PAID_OWNED_EVENT_ID });
    expect(first.recorded).toBe(true);
    const stats = await api.getOrganizerEventStats(PAID_OWNED_EVENT_ID);
    expect(stats.views).toBe(5);

    const again = await api.recordPageView({ targetType: "event", targetId: PAID_OWNED_EVENT_ID });
    expect(again.recorded).toBe(false);
    const after = await api.getOrganizerEventStats(PAID_OWNED_EVENT_ID);
    expect(after.views).toBe(5);
  });

  it("trackPageView is fire-and-forget: an invalid payload is rejected by the API but swallowed for the page", async () => {
    restore = installMockApi();
    const api = client();
    // негативный путь: битый id падает с 400 на прямом вызове...
    await expect(api.recordPageView({ targetType: "event", targetId: "not-an-id" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    // ...а fire-and-forget хелпер глотает отказ (непроглоченный rejection уронил бы весь прогон vitest)
    trackPageView({ targetType: "event", targetId: "not-an-id" });
    const stats = await api.getOrganizerEventStats(PAID_OWNED_EVENT_ID);
    expect(stats.views).toBe(4);
  });

  it("computes the organizer rating from reviews and hides it below the minimum (null envelope, no zeros)", async () => {
    restore = installMockApi();
    const api = client();

    const forEvent = await api.getEventOrganizerRating(CATALOG_EVENT_ID);
    expect(forEvent.rating).not.toBeNull();
    expect(forEvent.rating!.reviewsCount).toBe(5);
    expect(forEvent.rating!.averageStars).toBeCloseTo(4.6);
    expect(forEvent.rating!.recommendPercent).toBe(80);

    const forOrganizer = await api.getOrganizerRating(ORGANIZER_ID);
    expect(forOrganizer.rating?.reviewsCount).toBe(5);

    // мало отзывов -> null (карточка не рендерится): у юзера без событий и у демо-организатора без отзывов
    expect((await api.getOrganizerRating(UNKNOWN_ID)).rating).toBeNull();
    expect((await api.getOrganizerRating("a0000000-0000-4000-8000-000000000001")).rating).toBeNull();

    await expect(api.getEventOrganizerRating(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("creates and lists promo campaigns, rejecting duplicates and foreign events", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createCampaign(PAID_OWNED_EVENT_ID, { type: "refer_a_friend", code: " friend10 ", title: "Приведи друга" });
    expect(created).toMatchObject({ code: "FRIEND10", status: "active", fulfillmentCount: 0 });

    const list = await api.listCampaigns(PAID_OWNED_EVENT_ID);
    expect(list.map((campaign) => campaign.code)).toEqual(["FRIEND10"]);

    // негативные пути: дубликат кода (409), пустой заголовок (400), чужое событие (403), неизвестное (404)
    await expect(api.createCampaign(PAID_OWNED_EVENT_ID, { type: "special_offer", code: "FRIEND10", title: "Повтор" })).rejects.toMatchObject({ name: "ApiError", status: 409 });
    await expect(api.createCampaign(PAID_OWNED_EVENT_ID, { type: "special_offer", code: "X", title: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.listCampaigns(CATALOG_EVENT_ID)).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.listCampaigns(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("creates promotions, requires the audience for target_collection (refine) and stamps the payment", async () => {
    restore = installMockApi();
    const api = client();

    const boost = await api.createPromotion(PAID_OWNED_EVENT_ID, { ...FUTURE_PROMOTION });
    expect(boost).toMatchObject({ type: "boost", status: "active", paidAt: null, tariffCode: "boost-7", priceRub: 990 });

    const targeted = await api.createPromotion(PAID_OWNED_EVENT_ID, { ...FUTURE_PROMOTION, type: "target_collection", tariffCode: "target-30", audience: { minVisits: 2, windowDays: 30, category: "afisha" } });
    expect(targeted.audience).toMatchObject({ minVisits: 2, windowDays: 30, category: "afisha" });

    // refine parity: target_collection без audience -> 400
    await expect(api.createPromotion(PAID_OWNED_EVENT_ID, { ...FUTURE_PROMOTION, type: "target_collection", tariffCode: "target-30" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    // период: endsAt не позже startsAt -> 400
    await expect(api.createPromotion(PAID_OWNED_EVENT_ID, { ...FUTURE_PROMOTION, endsAt: FUTURE_PROMOTION.startsAt })).rejects.toMatchObject({ name: "ApiError", status: 400 });

    const list = await api.listPromotions(PAID_OWNED_EVENT_ID);
    expect(list).toHaveLength(2);

    const paid = await api.markPromotionPaid(PAID_OWNED_EVENT_ID, boost.id);
    expect(paid.paidAt).not.toBeNull();
    const after = await api.listPromotions(PAID_OWNED_EVENT_ID);
    expect(after.find((campaign) => campaign.id === boost.id)?.paidAt).not.toBeNull();

    await expect(api.markPromotionPaid(PAID_OWNED_EVENT_ID, UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.createPromotion(CATALOG_EVENT_ID, { ...FUTURE_PROMOTION })).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.listPromotions(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("creates an already-expired campaign as completed (backend lazy-expiry parity)", async () => {
    restore = installMockApi();
    const past = await client().createPromotion(PAID_OWNED_EVENT_ID, { type: "banner", startsAt: "2026-01-01T10:00:00+03:00", endsAt: "2026-01-08T10:00:00+03:00", tariffCode: "banner-7", priceRub: 500 });
    expect(past.status).toBe("completed");
    expect(past.completedAt).toBe(past.endsAt);
  });

  it("creates and lists promocodes, rejecting duplicates and foreign events (#372)", async () => {
    restore = installMockApi();
    const api = client();

    const created = await api.createOrganizerPromo(PAID_OWNED_EVENT_ID, { code: " friend10 ", maxRedemptions: 5, expiresAt: "2027-06-01T10:00:00Z" });
    expect(created).toMatchObject({ code: "FRIEND10", maxRedemptions: 5, redeemedCount: 0 });

    const list = await api.listOrganizerPromos(PAID_OWNED_EVENT_ID);
    expect(list.map((code) => code.code)).toEqual(["FRIEND10"]);

    // негативные пути: дубликат кода (409), пустой код (400), чужое событие (403), неизвестное (404)
    await expect(api.createOrganizerPromo(PAID_OWNED_EVENT_ID, { code: "friend10" })).rejects.toMatchObject({ name: "ApiError", status: 409 });
    await expect(api.createOrganizerPromo(PAID_OWNED_EVENT_ID, { code: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.listOrganizerPromos(CATALOG_EVENT_ID)).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.listOrganizerPromos(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("sets the early-access window on an owned event and resets with the organizer seed (#372)", async () => {
    restore = installMockApi();
    const api = client();

    const result = await api.setOrganizerEarlyAccess(PAID_OWNED_EVENT_ID, "2027-06-01T10:00:00Z");
    expect(result).toEqual({ bookingOpensAt: "2027-06-01T10:00:00Z" });
    const stored = (await api.listOrganizerEvents()).find((item) => item.id === PAID_OWNED_EVENT_ID);
    expect(stored?.bookingOpensAt).toBe("2027-06-01T10:00:00Z");

    // негативные пути: невалидный timestamp без offset (400), чужое событие (403), неизвестное (404)
    await expect(api.setOrganizerEarlyAccess(PAID_OWNED_EVENT_ID, "2027-06-01T10:00")).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.setOrganizerEarlyAccess(CATALOG_EVENT_ID, "2027-06-01T10:00:00Z")).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.setOrganizerEarlyAccess(UNKNOWN_ID, "2027-06-01T10:00:00Z")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
