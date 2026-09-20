import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { PromoCampaign } from "@max-events/api-contracts";
import { EventReferralController } from "./promo.controller";
import type { PromoService } from "./promo.service";

const eventId = "00000000-0000-4000-8000-0000000000e1";

const referral: PromoCampaign = {
  id: "00000000-0000-4000-8000-0000000000c1",
  eventId,
  type: "refer_a_friend",
  status: "active",
  code: "FRIEND",
  title: "Приведи друга",
  maxFulfillments: 3,
  fulfillmentCount: 1,
  createdAt: "2026-09-12T10:00:00.000Z",
  completedAt: null,
};

describe("EventReferralController", () => {
  it("returns the referral campaign of the requested event", async () => {
    const asked: string[] = [];
    const promo = {
      activeReferral: async (id: string) => {
        asked.push(id);
        return referral;
      },
    } as unknown as PromoService;
    await expect(new EventReferralController(promo).referral(eventId)).resolves.toEqual(referral);
    expect(asked).toEqual([eventId]);
  });

  it("propagates a missing campaign as a 404", async () => {
    const promo = {
      activeReferral: async () => {
        throw new NotFoundException("Referral campaign not found");
      },
    } as unknown as PromoService;
    await expect(new EventReferralController(promo).referral(eventId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
