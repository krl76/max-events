// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for people matching.
// SCOPE: GET /people with optional lat/lng.
// DEPENDS: @nestjs/common, ../auth/auth.guard, ../today/today.controller parseOrigin, ./people.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PeopleController - GET /people
// END_MODULE_MAP

import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { PeopleResponse } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { parseOrigin } from "../today/today.controller";
import { UserEntity } from "../users/user.entity";
import { PeopleService } from "./people.service";

@Controller("people")
export class PeopleController {
  constructor(@Inject(PeopleService) private readonly people: PeopleService) {}

  @Get()
  suggest(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<PeopleResponse> {
    return this.people.suggest(user.id, parseOrigin(query));
  }
}
