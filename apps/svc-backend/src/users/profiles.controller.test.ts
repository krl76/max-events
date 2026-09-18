import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, type Profile, type UpdateProfile } from "@max-events/api-contracts";
import { UserEntity } from "./user.entity";
import { ProfilesController } from "./profiles.controller";
import type { ProfilesService } from "./profiles.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const profile: Profile = { userId: user.id, city: "Москва", interests: [], smartAlerts: DEFAULT_SMART_ALERTS, privacy: DEFAULT_PRIVACY, recommendationsEnabled: true };

function createController() {
  const calls: { getOrCreate?: string; update?: { userId: string; patch: unknown } } = {};
  const service = {
    getOrCreate: async (userId: string) => {
      calls.getOrCreate = userId;
      return profile;
    },
    update: async (userId: string, patch: UpdateProfile) => {
      calls.update = { userId, patch };
      return { ...profile, ...patch };
    },
  } as unknown as ProfilesService;
  return { calls, controller: new ProfilesController(service) };
}

describe("ProfilesController", () => {
  it("reads the current user's profile", async () => {
    const { calls, controller } = createController();
    await expect(controller.get(user)).resolves.toEqual(profile);
    expect(calls.getOrCreate).toBe(user.id);
  });

  it("rejects an invalid patch and applies a valid one", async () => {
    const { calls, controller } = createController();
    await expect(controller.update(user, { city: "" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.update(user, { city: "Казань" })).resolves.toMatchObject({ city: "Казань" });
    expect(calls.update).toEqual({ userId: user.id, patch: { city: "Казань" } });
    await expect(controller.update(user, { smartAlerts: { weather: false } })).resolves.toMatchObject({ smartAlerts: { weather: false } });
  });
});
