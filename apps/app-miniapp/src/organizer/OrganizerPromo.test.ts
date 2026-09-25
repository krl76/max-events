import { describe, expect, it } from "vitest";
import type { EventSalesReport, PromoCampaign, PromoCode, PromotionCampaign } from "@max-events/api-contracts";
import type { OrganizerEvent } from "../api/client";
import { PROMO_PERIODS, campaignRows, formatDelta, periodQueryFor, promotionTimeLeft, salesCsv } from "./OrganizerPromo";

const EVENT_ID = "c00000f2-0000-4000-8000-0000000000f2";

const event = { id: EVENT_ID, title: "Квиз «Мозгобойня»" } as OrganizerEvent;

describe("periodQueryFor", () => {
  it("looks N days back from now and closes the window at now", () => {
    const now = new Date("2026-09-19T12:00:00+03:00");
    const period = periodQueryFor(30, now);

    expect(period.to).toBe(now.toISOString());
    expect(new Date(period.from!).toISOString()).toBe(new Date("2026-08-20T12:00:00+03:00").toISOString());
  });

  it("offers the three windows of the period pill", () => {
    expect(PROMO_PERIODS.map((period) => period.days)).toEqual([7, 30, 90]);
  });
});

describe("formatDelta", () => {
  it("signs a rise and says nothing to compare with when there is nothing", () => {
    expect(formatDelta(18)).toBe("+18% к прошлому периоду");
    expect(formatDelta(-4)).toBe("-4% к прошлому периоду");
    expect(formatDelta(null)).toBe("—");
  });
});

describe("promotionTimeLeft", () => {
  const now = new Date("2026-09-19T12:00:00+03:00");

  it("counts hours near the end, days further out, and calls a finished campaign finished", () => {
    expect(promotionTimeLeft("2026-09-20T02:00:00+03:00", now)).toBe("Осталось 14 ч");
    expect(promotionTimeLeft("2026-09-22T12:00:00+03:00", now)).toBe("Осталось 3 дня");
    expect(promotionTimeLeft("2026-09-18T12:00:00+03:00", now)).toBe("Завершена");
  });
});

describe("campaignRows", () => {
  const now = new Date("2026-09-19T12:00:00+03:00");
  const promotion = { id: "f4000000-0000-4000-8000-000000000001", eventId: EVENT_ID, type: "boost", status: "active", startsAt: "2026-09-19T00:00:00+03:00", endsAt: "2026-09-20T00:00:00+03:00", tariffCode: "boost-24h", priceRub: 0, paidAt: null, audience: null, createdAt: "2026-09-19T00:00:00+03:00", completedAt: null } as PromotionCampaign;
  const campaign = { id: "f3000000-0000-4000-8000-000000000001", eventId: EVENT_ID, type: "refer_a_friend", status: "active", code: "ДРУГ", title: "Приведи друга", maxFulfillments: null, fulfillmentCount: 2, createdAt: "2026-09-18T00:00:00+03:00", completedAt: null } as PromoCampaign;
  const code = { id: "f2000000-0000-4000-8000-000000000001", eventId: EVENT_ID, code: "ОСЕНЬ20", maxRedemptions: 100, redeemedCount: 47, expiresAt: null, createdAt: "2026-09-17T00:00:00+03:00" } as PromoCode;

  it("merges the three endpoints into one list and names the event behind each row", () => {
    const rows = campaignRows([promotion], [campaign], [code], [event], now);

    expect(rows).toHaveLength(3);
    expect(rows[0].title).toBe("Поднятие в ленте · Квиз «Мозгобойня»");
    expect(rows[1].title).toBe("Приведи друга · Квиз «Мозгобойня»");
    expect(rows[2]).toMatchObject({ title: "Промокод ОСЕНЬ20", note: "Использован 47 раз из 100", progress: null });
  });

  it("shows how far a timed campaign has run and nothing where there is no clock", () => {
    const rows = campaignRows([promotion], [], [code], [event], now);

    expect(rows[0].progress).toBe(50);
    expect(rows[1].progress).toBeNull();
  });
});

describe("salesCsv", () => {
  const report: EventSalesReport = {
    eventId: EVENT_ID,
    period: { from: null, to: null },
    rows: [{ paymentId: "700000f2-0000-4000-8000-0000000000f1", bookingId: "e00000f2-0000-4000-8000-0000000000f1", status: "succeeded", grossRub: 500, commissionRub: 50, netRub: 450, commissionBps: 1000, commissionFixedAt: "2026-08-01T12:00:00+03:00" }],
    grossRub: 500,
    commissionRub: 50,
    netRub: 450,
    provider: "sandbox",
  };

  it("writes a header, one line per settled sale and a totals line", () => {
    const lines = salesCsv([{ title: "Квиз «Мозгобойня»", report }]).split("\n");

    expect(lines[0]).toContain("событие;платёж");
    expect(lines[0]).toContain("контур");
    expect(lines[1]).toContain("Квиз «Мозгобойня»");
    expect(lines[1]).toContain("450");
    expect(lines[1]).toContain("sandbox");
    expect(lines.at(-1)).toBe("ИТОГО;;;500;50;450;;");
  });

  it("still produces a report when an event sold nothing", () => {
    expect(salesCsv([]).split("\n")).toHaveLength(2);
  });
});
