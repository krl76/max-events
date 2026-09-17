// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for taste graph and «После меня» suggestions.
// SCOPE: GET /taste, GET /taste/after-me for CurrentUser.
// DEPENDS: @nestjs/common, ../auth/auth.guard, ./taste.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TasteController - profile and after-me
// END_MODULE_MAP

import { Controller, Get, Inject } from "@nestjs/common";
import type { AfterMeResponse, TasteProfile } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { TasteService } from "./taste.service";

@Controller("taste")
export class TasteController {
  constructor(@Inject(TasteService) private readonly taste: TasteService) {}

  @Get()
  profile(@CurrentUser() user: UserEntity): Promise<TasteProfile> {
    return this.taste.profile(user.id);
  }

  @Get("after-me")
  afterMe(@CurrentUser() user: UserEntity): Promise<AfterMeResponse> {
    return this.taste.afterMe(user.id);
  }
}
