import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, type Profile } from "@max-events/api-contracts";
import { UserEntity } from "./user.entity";
import { UsersController } from "./users.controller";
import type { ProfilesService } from "./profiles.service";
import type { UsersService } from "./users.service";

const viewer = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const other: UserEntity = {
  id: "00000000-0000-4000-8000-0000000000b1",
  maxUserId: "42",
  firstName: "Анна",
  lastName: "Соколова",
  username: null,
  avatarUrl: null,
  avatarCustom: false,
  bannedFromPublishing: false,
  friendsSyncedAt: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};
const profile: Profile = { userId: other.id, city: "Москва", interests: ["джаз"], smartAlerts: DEFAULT_SMART_ALERTS, privacy: DEFAULT_PRIVACY, recommendationsEnabled: true, bio: "Люблю джаз", coverUrl: null };

function createController(found: UserEntity | null = other) {
  const users = {
    findById: async (id: string) => (found && found.id === id ? found : null),
  } as unknown as UsersService;
  const profiles = {
    getOrCreate: async (userId: string) => ({ ...profile, userId }),
  } as unknown as ProfilesService;
  return new UsersController(users, profiles);
}

describe("UsersController", () => {
  it("returns the public user and profile of the person in the path", async () => {
    const controller = createController();
    await expect(controller.get(viewer, other.id)).resolves.toMatchObject({ id: other.id, firstName: "Анна", lastName: "Соколова" });
    await expect(controller.profile(viewer, other.id)).resolves.toMatchObject({ userId: other.id, bio: "Люблю джаз" });
  });

  it("answers 404 when that person is not in the table", async () => {
    const controller = createController(null);
    await expect(controller.get(viewer, other.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.profile(viewer, other.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
