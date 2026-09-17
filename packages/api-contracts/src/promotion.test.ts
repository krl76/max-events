import { describe, expect, it } from "vitest";
import { CreatePromotionWriteSchema, PromotionCampaignSchema, RecordPromotionPaymentWriteSchema } from "./promotion.js";

const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";
const campaignId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";

describe("CreatePromotionWriteSchema", () => {
  it("accepts the four campaign types and requires audience only for target collections", () => {
    expect(CreatePromotionWriteSchema.parse({ type: "boost", startsAt: "2026-09-12T00:00:00+03:00", endsAt: "2026-09-19T00:00:00+03:00", tariffCode: "boost_week", priceRub: 4900 }).type).toBe("boost");
    expect(CreatePromotionWriteSchema.safeParse({ type: "banner", startsAt: "2026-09-12T00:00:00+03:00", endsAt: "2026-09-13T00:00:00+03:00", tariffCode: "banner_day", priceRub: 1500 }).success).toBe(true);
    expect(CreatePromotionWriteSchema.safeParse({ type: "pin", startsAt: "2026-09-12T00:00:00+03:00", endsAt: "2026-09-13T00:00:00+03:00", tariffCode: "pin_day", priceRub: 900 }).success).toBe(true);
    expect(CreatePromotionWriteSchema.safeParse({ type: "target_collection", startsAt: "2026-09-12T00:00:00+03:00", endsAt: "2026-09-19T00:00:00+03:00", tariffCode: "target_week", priceRub: 7900 }).success).toBe(false);
    const targeted = CreatePromotionWriteSchema.parse({
      type: "target_collection",
      startsAt: "2026-09-12T00:00:00+03:00",
      endsAt: "2026-09-19T00:00:00+03:00",
      tariffCode: "target_week",
      priceRub: 7900,
      audience: { minVisits: 3, windowDays: 180, category: "afisha" },
    });
    expect(targeted.audience?.minVisits).toBe(3);
  });

  it("rejects a period that ends before it starts", () => {
    expect(
      CreatePromotionWriteSchema.safeParse({
        type: "boost",
        startsAt: "2026-09-19T00:00:00+03:00",
        endsAt: "2026-09-12T00:00:00+03:00",
        tariffCode: "boost_week",
        priceRub: 4900,
      }).success,
    ).toBe(false);
  });
});

describe("PromotionCampaignSchema", () => {
  it("stores tariff and price as billing fields with a nullable payment stamp", () => {
    const parsed = PromotionCampaignSchema.parse({
      id: campaignId,
      eventId,
      type: "banner",
      status: "active",
      startsAt: "2026-09-12T00:00:00+03:00",
      endsAt: "2026-09-13T00:00:00+03:00",
      tariffCode: "banner_day",
      priceRub: 1500,
      paidAt: null,
      audience: null,
      createdAt: "2026-09-12T00:00:00+03:00",
      completedAt: null,
    });
    expect(parsed.priceRub).toBe(1500);
    expect(parsed.paidAt).toBeNull();
    expect(RecordPromotionPaymentWriteSchema.parse({ paidAt: "2026-09-12T12:00:00+03:00" }).paidAt).toBe("2026-09-12T12:00:00+03:00");
  });
});
