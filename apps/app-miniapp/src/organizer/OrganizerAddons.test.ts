import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pluralRu } from "../catalog/format";
import { EMPTY_PROMOTION_DRAFT, EarlyAccessSection, EventStatsView, ExpandableSection, OrganizerRatingView, PromoCampaignRow, PromoCodeRow, PromoForm, CampaignForm, EMPTY_PROMO_DRAFT, EMPTY_CAMPAIGN_DRAFT, PromotionCampaignRow, PromotionForm, campaignDraftErrors, promoDraftErrors, promotionDraftErrors, toCreateCampaign, toCreatePromotion, toCreatePromo, type PromotionDraft, type PromoDraft } from "./OrganizerAddons";
import type { EventSalesReport, OrganizerEventStats, OrganizerRating, PromoCampaign, PromoCode, PromotionCampaign } from "@max-events/api-contracts";

const noop = () => {};

const rating: OrganizerRating = { organizerUserId: "d0000001-0000-4000-8000-000000000001", averageStars: 4.6, recommendPercent: 80, visitsCount: 3, onTimePercent: 95, reviewsCount: 5 };

const stats: OrganizerEventStats = { eventId: "c00000f2-0000-4000-8000-0000000000f2", views: 4, bookings: 3, cancellations: 1, paidBookings: 2 };

const report: EventSalesReport = {
  eventId: stats.eventId,
  rows: [{ paymentId: "700000f2-0000-4000-8000-0000000000f1", bookingId: "e00000f2-0000-4000-8000-0000000000f1", status: "succeeded", grossRub: 500, commissionRub: 50, netRub: 450, commissionBps: 1000, commissionFixedAt: "2026-08-01T12:00:00+03:00" }],
  grossRub: 500,
  commissionRub: 50,
  netRub: 450,
};

const unpaidCampaign: PromotionCampaign = { id: "f4000000-0000-4000-8000-000000000001", eventId: stats.eventId, type: "boost", status: "active", startsAt: "2027-01-01T10:00:00+03:00", endsAt: "2027-01-08T10:00:00+03:00", tariffCode: "boost-7", priceRub: 990, paidAt: null, audience: null, createdAt: "2026-09-01T10:00:00+03:00", completedAt: null };

const targetedCampaign: PromotionCampaign = { ...unpaidCampaign, id: "f4000000-0000-4000-8000-000000000002", type: "target_collection", paidAt: "2026-09-02T10:00:00+03:00", audience: { minVisits: 2, windowDays: 30, category: "afisha" } };

const readyDraft: PromotionDraft = { type: "boost", startsAt: "2027-01-01T10:00", endsAt: "2027-01-08T10:00", tariffCode: "boost-7", priceRub: "990", minVisits: "2", windowDays: "30", category: "" };

describe("ru visits counter label", () => {
  it("pluralizes the ru visit counter", () => {
    expect(`1 ${pluralRu(1, "посещение", "посещения", "посещений")}`).toBe("1 посещение");
    expect(`3 ${pluralRu(3, "посещение", "посещения", "посещений")}`).toBe("3 посещения");
    expect(`12 ${pluralRu(12, "посещение", "посещения", "посещений")}`).toBe("12 посещений");
    expect(`21 ${pluralRu(21, "посещение", "посещения", "посещений")}`).toBe("21 посещение");
  });
});

describe("OrganizerRatingView", () => {
  it("renders stars, recommend share, visits and the on-time share", () => {
    const html = renderToStaticMarkup(createElement(OrganizerRatingView, { rating }));
    expect(html).toContain("4.6 ⭐");
    expect(html).toContain("80% рекомендуют");
    expect(html).toContain("3 посещения");
    expect(html).toContain("95% вовремя");
  });

  it("omits the on-time line when it is null", () => {
    const html = renderToStaticMarkup(createElement(OrganizerRatingView, { rating: { ...rating, onTimePercent: null } }));
    expect(html).not.toContain("вовремя");
  });

  it("renders nothing for null (too few reviews — never show zeros)", () => {
    expect(renderToStaticMarkup(createElement(OrganizerRatingView, { rating: null }))).toBe("");
  });
});

describe("EventStatsView", () => {
  it("renders the counters, the sales summary and the frozen sale rows (money as-is from the API)", () => {
    const html = renderToStaticMarkup(createElement(EventStatsView, { stats, report }));
    expect(html).toContain("Просмотры: 4");
    expect(html).toContain("Записи: 3");
    expect(html).toContain("Отмены: 1");
    expect(html).toContain("Оплаченные записи: 2");
    expect(html).toContain("Продажи: 500 ₽");
    expect(html).toContain("комиссия 50 ₽");
    expect(html).toContain("к выплате 450 ₽");
  });

  it("renders zero totals without sale rows for an event without sales", () => {
    const html = renderToStaticMarkup(createElement(EventStatsView, { stats: { ...stats, views: 0, bookings: 0, cancellations: 0, paidBookings: 0 }, report: { ...report, rows: [], grossRub: 0, commissionRub: 0, netRub: 0 } }));
    expect(html).toContain("Просмотры: 0");
    expect(html).toContain("Продажи: 0 ₽");
    expect(html).not.toContain("к выплате 450 ₽");
  });
});

describe("promotionDraftErrors", () => {
  it("accepts a ready draft and reports every missing required field", () => {
    expect(promotionDraftErrors(readyDraft)).toEqual([]);
    expect(promotionDraftErrors(EMPTY_PROMOTION_DRAFT)).toEqual(["Укажите начало кампании", "Укажите окончание кампании", "Укажите тариф", "Цена — целое число от 0"]);
  });

  it("rejects an endsAt that is not after startsAt and a negative price", () => {
    expect(promotionDraftErrors({ ...readyDraft, endsAt: "2027-01-01T10:00" })).toContain("Окончание должно быть позже начала");
    expect(promotionDraftErrors({ ...readyDraft, priceRub: "-5" })).toContain("Цена — целое число от 0");
  });

  it("requires the audience numbers only for target_collection", () => {
    const targeted: PromotionDraft = { ...readyDraft, type: "target_collection" };
    expect(promotionDraftErrors(targeted)).toEqual([]);
    expect(promotionDraftErrors({ ...targeted, minVisits: "0" })).toContain("Минимум посещений — целое число от 1");
    expect(promotionDraftErrors({ ...targeted, windowDays: "" })).toContain("Окно аудитории — целое число дней от 1");
    // не-target типы игнорируют поля аудитории
    expect(promotionDraftErrors({ ...readyDraft, minVisits: "0", windowDays: "" })).toEqual([]);
  });
});

describe("toCreatePromotion", () => {
  it("maps a boost draft without the audience", () => {
    const payload = toCreatePromotion(readyDraft);
    expect(payload.type).toBe("boost");
    expect(payload.audience).toBeNull();
    expect(payload.priceRub).toBe(990);
    expect(payload.tariffCode).toBe("boost-7");
    expect(new Date(payload.startsAt).getTime()).toBe(new Date(readyDraft.startsAt).getTime());
  });

  it("maps a target_collection draft with the audience and the optional category", () => {
    const withCategory = toCreatePromotion({ ...readyDraft, type: "target_collection", minVisits: "3", windowDays: "14", category: "sport" });
    expect(withCategory.audience).toEqual({ minVisits: 3, windowDays: 14, category: "sport" });

    const withoutCategory = toCreatePromotion({ ...readyDraft, type: "target_collection", minVisits: "3", windowDays: "14" });
    expect(withoutCategory.audience).toEqual({ minVisits: 3, windowDays: 14 });
  });
});

describe("PromotionCampaignRow", () => {
  it("offers the paid stamp on an unpaid campaign", () => {
    const html = renderToStaticMarkup(createElement(PromotionCampaignRow, { campaign: unpaidCampaign, paying: false, onPaid: noop }));
    expect(html).toContain("Буст");
    expect(html).toContain("Активна");
    expect(html).toContain("boost-7");
    expect(html).toContain("990 ₽");
    expect(html).toContain("Отметить оплаченной");
    expect(html).not.toContain("оплачена");
  });

  it("shows the paid marker and the audience instead of the stamp on a paid target_collection", () => {
    const html = renderToStaticMarkup(createElement(PromotionCampaignRow, { campaign: targetedCampaign, paying: false, onPaid: noop }));
    expect(html).toContain("Подборка по аудитории");
    expect(html).toContain("оплачена");
    expect(html).toContain("от 2 посещений за 30 дн.");
    expect(html).toContain("Афиша");
    expect(html).not.toContain("Отметить оплаченной");
  });
});

describe("PromotionForm", () => {
  const form = (over: { draft?: PromotionDraft; errors?: string[]; failed?: boolean } = {}) => renderToStaticMarkup(createElement(PromotionForm, { draft: over.draft ?? EMPTY_PROMOTION_DRAFT, errors: over.errors ?? [], submitting: false, failed: over.failed ?? false, onChange: noop, onSubmit: noop, onCancel: noop }));

  it("renders the type options and hides the audience fields outside target_collection", () => {
    const html = form();
    expect(html).toContain("Буст");
    expect(html).toContain("Подборка по аудитории");
    expect(html).not.toContain("Минимум посещений");
  });

  it("reveals the audience fields for target_collection and shows inline errors", () => {
    const html = form({ draft: { ...EMPTY_PROMOTION_DRAFT, type: "target_collection" }, errors: ["Укажите тариф"], failed: true });
    expect(html).toContain("Минимум посещений");
    expect(html).toContain("Окно аудитории, дней");
    expect(html).toContain("Укажите тариф");
    expect(html).toContain("Не удалось сохранить");
  });
});

describe("promocode organizer helpers (#372)", () => {
  const ready: PromoDraft = { code: " friend10 ", maxRedemptions: "5", expiresAt: "2027-06-01T10:00" };
  const code: PromoCode = { id: "f2000000-0000-4000-8000-000000000001", eventId: stats.eventId, code: "FRIEND10", maxRedemptions: 5, redeemedCount: 2, expiresAt: "2027-06-01T10:00:00Z", createdAt: "2026-09-01T10:00:00Z" };

  it("accepts a ready draft and reports the missing code", () => {
    expect(promoDraftErrors(ready)).toEqual([]);
    expect(promoDraftErrors(EMPTY_PROMO_DRAFT)).toEqual(["Укажите код (до 40 символов)"]);
  });

  it("rejects a non-positive limit but allows an empty one", () => {
    expect(promoDraftErrors({ ...ready, maxRedemptions: "0" })).toContain("Лимит — целое число от 1 или пусто");
    expect(promoDraftErrors({ ...ready, maxRedemptions: "" })).toEqual([]);
  });

  it("maps the draft to the write payload with optional fields dropped", () => {
    const payload = toCreatePromo(ready);
    expect(payload).toEqual({ code: "friend10", maxRedemptions: 5, expiresAt: new Date("2027-06-01T10:00").toISOString() });
    expect(toCreatePromo({ code: "X", maxRedemptions: "", expiresAt: "" })).toEqual({ code: "X" });
  });

  it("shows the code, redemptions and expiry on the row", () => {
    const html = renderToStaticMarkup(createElement(PromoCodeRow, { code }));
    expect(html).toContain("FRIEND10");
    expect(html).toContain("Использований: 2 из 5");
    expect(html).toContain("До ");
  });

  it("marks an unlimited code without an expiry line", () => {
    const html = renderToStaticMarkup(createElement(PromoCodeRow, { code: { ...code, maxRedemptions: null, expiresAt: null } }));
    expect(html).toContain("без лимита");
    expect(html).not.toContain("До ");
  });

  it("renders the create form with the code, limit and expiry fields", () => {
    const html = renderToStaticMarkup(createElement(PromoForm, { draft: EMPTY_PROMO_DRAFT, errors: ["Укажите код (до 40 символов)"], submitting: false, failed: true, onChange: noop, onSubmit: noop, onCancel: noop }));
    expect(html).toContain('aria-label="Код промокода"');
    expect(html).toContain('aria-label="Лимит применений"');
    expect(html).toContain('aria-label="Действует до"');
    expect(html).toContain("Укажите код (до 40 символов)");
    expect(html).toContain("Не удалось сохранить");
  });
});

describe("promo campaign organizer helpers (#372)", () => {
  it("reports the missing code and title", () => {
    expect(campaignDraftErrors({ type: "refer_a_friend", code: " FRIEND10 ", title: "Приведи друга" })).toEqual([]);
    expect(campaignDraftErrors(EMPTY_CAMPAIGN_DRAFT)).toEqual(["Укажите код (до 40 символов)", "Укажите название акции"]);
  });

  it("maps the draft to the write payload trimmed", () => {
    expect(toCreateCampaign({ type: "special_offer", code: " X ", title: " Скидка " })).toEqual({ type: "special_offer", code: "X", title: "Скидка" });
  });

  it("shows the shareable campaign code on the row", () => {
    const campaign: PromoCampaign = { id: "f3000000-0000-4000-8000-000000000001", eventId: stats.eventId, type: "refer_a_friend", status: "active", code: "FRIEND10", title: "Приведи друга", maxFulfillments: 10, fulfillmentCount: 3, createdAt: "2026-09-01T10:00:00Z", completedAt: null };
    const html = renderToStaticMarkup(createElement(PromoCampaignRow, { campaign }));
    expect(html).toContain("Приведи друга · Активна");
    expect(html).toContain("Код акции: FRIEND10");
    expect(html).toContain("Выполнений: 3 из 10");
  });

  it("renders the create form with the type select and both inputs", () => {
    const html = renderToStaticMarkup(createElement(CampaignForm, { draft: EMPTY_CAMPAIGN_DRAFT, errors: ["Укажите название акции"], submitting: false, failed: false, onChange: noop, onSubmit: noop, onCancel: noop }));
    expect(html).toContain("Приведи друга");
    expect(html).toContain("Спецпредложение");
    expect(html).toContain('aria-label="Код акции"');
    expect(html).toContain('aria-label="Название акции"');
    expect(html).toContain("Укажите название акции");
  });

  it("renders the collapsed early-access toggle with the current window hidden", () => {
    const html = renderToStaticMarkup(createElement(EarlyAccessSection, { eventId: stats.eventId, bookingOpensAt: "2027-06-01T10:00:00Z" }));
    expect(html).toContain("Ранний доступ");
    expect(html).not.toContain("Запись откроется");
  });
});

describe("ExpandableSection", () => {
  const base = {
    label: "Продвижение",
    openLabel: "Скрыть продвижение",
    errorText: "Не удалось загрузить кампании.",
    list: { open: false, toggle: noop, state: null },
    children: (items: string[]) => createElement("p", null, items.join(",")),
  };

  it("renders the collapsed toggle and hides the content", () => {
    const html = renderToStaticMarkup(createElement(ExpandableSection<string>, base));
    expect(html).toContain("Продвижение");
    expect(html).not.toContain("Скрыть продвижение");
    expect(html).not.toContain("Загрузка");
  });

  it("renders the loading/error app states and the ready items", () => {
    const loading = renderToStaticMarkup(createElement(ExpandableSection<string>, { ...base, list: { open: true, toggle: noop, state: { status: "loading" } } }));
    expect(loading).toContain("Загрузка…");
    const error = renderToStaticMarkup(createElement(ExpandableSection<string>, { ...base, list: { open: true, toggle: noop, state: { status: "error" } } }));
    expect(error).toContain("Не удалось загрузить кампании.");
    const ready = renderToStaticMarkup(createElement(ExpandableSection<string>, { ...base, list: { open: true, toggle: noop, state: { status: "ready", items: ["a", "b"] } } }));
    expect(ready).toContain("<p>a,b</p>");
  });
});
