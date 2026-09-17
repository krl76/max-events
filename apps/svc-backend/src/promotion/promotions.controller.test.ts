import { describe, expect, it } from "vitest";
import type { PromotionPlacements, TargetedPromotionsResponse } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { PromotionsController } from "./promotions.controller";
import type { PromotionService } from "./promotion.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const emptyPlacements: PromotionPlacements = { banners: [], pins: [], boostedEventIds: [] };
const emptyMine: TargetedPromotionsResponse = { collections: [] };

describe("PromotionsController", () => {
  it("loads catalog placements without a user id and scopes for-me to the current user", async () => {
    const calls: { placements?: boolean; forMe?: string } = {};
    const promotions = {
      placements: async () => {
        calls.placements = true;
        return emptyPlacements;
      },
      targetedFor: async (userId: string) => {
        calls.forMe = userId;
        return emptyMine;
      },
    } as unknown as PromotionService;
    const controller = new PromotionsController(promotions);
    await expect(controller.placements()).resolves.toEqual(emptyPlacements);
    expect(calls.placements).toBe(true);
    await expect(controller.forMe(user)).resolves.toEqual(emptyMine);
    expect(calls.forMe).toBe(user.id);
  });
});
