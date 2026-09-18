import { describe, expect, it } from "vitest";
import { CreatePromoCampaignWriteSchema, CreatePromoCodeWriteSchema, EarlyAccessWriteSchema, OrganizerBookingRowSchema, PromoCampaignSchema, PromoCodeSchema } from "./promo.js";

const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";
const userId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const promoId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";

describe("PromoCodeSchema", () => {
  it("accepts a limited code and rejects a blank one", () => {
    const parsed = PromoCodeSchema.parse({
      id: promoId,
      eventId,
      code: "EARLY",
      maxRedemptions: 10,
      redeemedCount: 0,
      expiresAt: null,
      createdAt: "2026-09-01T10:00:00+03:00",
    });
    expect(parsed.code).toBe("EARLY");
    expect(CreatePromoCodeWriteSchema.safeParse({ code: "" }).success).toBe(false);
    expect(CreatePromoCodeWriteSchema.parse({ code: "early", maxRedemptions: 1 }).maxRedemptions).toBe(1);
  });
});

describe("EarlyAccessWriteSchema", () => {
  it("requires bookingOpensAt", () => {
    expect(EarlyAccessWriteSchema.safeParse({}).success).toBe(false);
    expect(EarlyAccessWriteSchema.parse({ bookingOpensAt: "2026-09-20T00:00:00+03:00" }).bookingOpensAt).toBe("2026-09-20T00:00:00+03:00");
  });
});

describe("PromoCampaignSchema", () => {
  it("accepts a refer-a-friend campaign write", () => {
    const write = CreatePromoCampaignWriteSchema.parse({ type: "refer_a_friend", code: "FRIEND", title: "Приведи друга", maxFulfillments: 20 });
    expect(write.type).toBe("refer_a_friend");
    expect(
      PromoCampaignSchema.parse({
        id: promoId,
        eventId,
        type: "special_offer",
        status: "active",
        code: "SALE",
        title: "Спецпредложение",
        maxFulfillments: null,
        fulfillmentCount: 0,
        createdAt: "2026-09-01T10:00:00+03:00",
        completedAt: null,
      }).status,
    ).toBe("active");
  });
});

describe("OrganizerBookingRowSchema", () => {
  it("includes the applied promo code", () => {
    const row = OrganizerBookingRowSchema.parse({
      id: promoId,
      userId,
      eventId,
      status: "active",
      promoCode: "EARLY",
      createdAt: "2026-09-01T10:00:00+03:00",
    });
    expect(row.promoCode).toBe("EARLY");
  });
});
