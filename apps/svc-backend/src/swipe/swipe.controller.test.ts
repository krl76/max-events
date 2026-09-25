import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { UserEntity } from "../users/user.entity";
import { SwipeController } from "./swipe.controller";
import type { SwipeService } from "./swipe.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const placeId = "00000000-0000-4000-8000-0000000000p1";

describe("SwipeController", () => {
  it("forwards the category, origin and swipe body", async () => {
    const calls: { list?: { category: string; origin: { latitude: number; longitude: number } | null }; decide?: { placeId: string; decision: string } } = {};
    const swipe = {
      list: async (_userId: string, category: string, origin: { latitude: number; longitude: number } | null) => {
        calls.list = { category, origin };
        return [];
      },
      decide: async (_userId: string, id: string, decision: string) => {
        calls.decide = { placeId: id, decision };
      },
    } as unknown as SwipeService;
    const controller = new SwipeController(swipe);
    await expect(controller.list(user, { category: "food", latitude: "55.75", longitude: "37.62" })).resolves.toEqual([]);
    expect(calls.list).toEqual({ category: "food", origin: { latitude: 55.75, longitude: 37.62 } });
    await expect(controller.decide(user, placeId, { decision: "skip" })).resolves.toBeUndefined();
    expect(calls.decide).toEqual({ placeId, decision: "skip" });
  });

  it("rejects a lone coordinate or an unknown decision", async () => {
    const swipe = { list: async () => [], decide: async () => undefined } as unknown as SwipeService;
    const controller = new SwipeController(swipe);
    await expect(controller.list(user, { latitude: "55.75" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.decide(user, placeId, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
