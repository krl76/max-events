// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for another person's public user row and profile.
// SCOPE: GET /users/:id, GET /users/:id/profile; identity is the CurrentUser guard, the id is the person being looked at.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./users.service, ./profiles.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UsersController - GET /users/:id and GET /users/:id/profile
// END_MODULE_MAP

import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe } from "@nestjs/common";
import type { Profile, User } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "./user.entity";
import { ProfilesService } from "./profiles.service";
import { toUserDto, UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
  ) {}

  @Get(":id")
  async get(@CurrentUser() _viewer: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException("User not found");
    return toUserDto(user);
  }

  @Get(":id/profile")
  async profile(@CurrentUser() _viewer: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Profile> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException("User not found");
    return this.profiles.getOrCreate(id);
  }
}
