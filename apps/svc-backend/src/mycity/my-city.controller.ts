// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for «Мой город» — GET /users/:userId/my-city.
// SCOPE: CurrentUser only; 403 for another user.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./my-city.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MyCityController - GET /users/:userId/my-city
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { MyCityPayload } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { MyCityService } from "./my-city.service";

@Controller("users")
export class MyCityController {
  constructor(@Inject(MyCityService) private readonly myCity: MyCityService) {}

  @Get(":userId/my-city")
  forUser(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<MyCityPayload> {
    return this.myCity.forUser(userId, user.id);
  }
}
