// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the place social page — GET /places/:id/page.
// SCOPE: Authenticated viewer; 404 unknown place.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./place-page.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacePageController - GET /places/:id/page
// END_MODULE_MAP

import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import type { PlacePage } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { PlacePageService } from "./place-page.service";

@Controller("places")
export class PlacePageController {
  constructor(@Inject(PlacePageService) private readonly pages: PlacePageService) {}

  @Get(":id/page")
  get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<PlacePage> {
    return this.pages.get(id, user.id);
  }
}
