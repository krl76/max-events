// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for "Where to go?" suggestions — GET /api/whereto.
// SCOPE: Query company/mood/budget via WheretoQuerySchema; 400 on invalid enums.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./whereto.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WheretoController - GET /whereto
// END_MODULE_MAP

import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { WheretoQuerySchema, type WheretoResponse } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { WheretoService } from "./whereto.service";

@Controller("whereto")
export class WheretoController {
  constructor(@Inject(WheretoService) private readonly whereto: WheretoService) {}

  @Get()
  async suggest(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<WheretoResponse> {
    const parsed = WheretoQuerySchema.safeParse({ company: query.company, mood: query.mood, budget: query.budget });
    if (!parsed.success) throw new BadRequestException("Invalid whereto query");
    return this.whereto.suggest(parsed.data, user.id);
  }
}
