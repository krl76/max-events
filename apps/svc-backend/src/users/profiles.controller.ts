// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the current user's profile — GET/PATCH /api/profile.
// SCOPE: Authenticated profile read/update; UpdateProfileSchema validation (400 on invalid payload).
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./profiles.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfilesController - /profile GET and PATCH
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import { UpdateProfileSchema, type Profile } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "./user.entity";
import { ProfilesService } from "./profiles.service";

@Controller("profile")
export class ProfilesController {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}

  @Get()
  get(@CurrentUser() user: UserEntity): Promise<Profile> {
    return this.profiles.getOrCreate(user.id);
  }

  @Patch()
  async update(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Profile> {
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid profile payload");
    return this.profiles.update(user.id, parsed.data);
  }
}
