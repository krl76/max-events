import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UserEntity } from "./user.entity";
import { ProfileSurfaceController } from "./profile-surface.controller";
import type { ProfileSurfaceService } from "./profile-surface.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;

describe("ProfileSurfaceController", () => {
  it("rejects an app-settings patch with a broken clock", async () => {
    const controller = new ProfileSurfaceController({
      updateAppSettings: async () => ({ userId: user.id }),
    } as unknown as ProfileSurfaceService);
    await expect(controller.updateAppSettings(user, user.id, { quietHoursFrom: "25:00" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
