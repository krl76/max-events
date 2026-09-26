// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for profile counters, visited places, author posts and app settings.
// SCOPE: GET /users/:userId/counters|visited-places|posts; GET/PATCH /users/:userId/app-settings (own only).
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./profile-surface.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileSurfaceController - /users/:userId aggregates of экран 36/41
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch } from "@nestjs/common";
import { UpdateAppSettingsSchema, type AppSettings, type ProfileCounters, type ProfilePost, type VisitedPlace } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { ProfileSurfaceService } from "./profile-surface.service";
import { UserEntity } from "./user.entity";

@Controller("users")
export class ProfileSurfaceController {
  constructor(@Inject(ProfileSurfaceService) private readonly surface: ProfileSurfaceService) {}

  @Get(":userId/counters")
  counters(@Param("userId", ParseUUIDPipe) userId: string): Promise<ProfileCounters> {
    return this.surface.counters(userId);
  }

  @Get(":userId/visited-places")
  visitedPlaces(@Param("userId", ParseUUIDPipe) userId: string): Promise<VisitedPlace[]> {
    return this.surface.visitedPlaces(userId);
  }

  @Get(":userId/posts")
  posts(@Param("userId", ParseUUIDPipe) userId: string): Promise<ProfilePost[]> {
    return this.surface.listPosts(userId);
  }

  @Get(":userId/app-settings")
  getAppSettings(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<AppSettings> {
    return this.surface.getAppSettings(userId, user.id);
  }

  @Patch(":userId/app-settings")
  async updateAppSettings(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) userId: string, @Body() body: unknown): Promise<AppSettings> {
    const parsed = UpdateAppSettingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid app settings payload");
    return this.surface.updateAppSettings(userId, user.id, parsed.data);
  }
}
