import { describe, expect, it } from "vitest";
import type { Achievement } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { AchievementsController } from "./achievements.controller";
import type { AchievementsService } from "./achievements.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const catalog = [{ code: "city_explorer", progress: 0 }] as Achievement[];

describe("AchievementsController", () => {
  it("forwards the path user id and the authenticated user", async () => {
    const calls: Array<{ userId: string; requesterId: string }> = [];
    const service = {
      list: async (userId: string, requesterId: string) => {
        calls.push({ userId, requesterId });
        return catalog;
      },
    } as unknown as AchievementsService;
    const controller = new AchievementsController(service);
    await expect(controller.list(user, user.id)).resolves.toEqual(catalog);
    expect(calls).toEqual([{ userId: user.id, requesterId: user.id }]);
  });
});
