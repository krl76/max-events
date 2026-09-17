// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for check-ins and visit stats.
// SCOPE: POST /check-ins; GET /users/:userId/visit-stats for CurrentUser only.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./check-ins.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CheckInsController - POST /check-ins
// - VisitStatsController - GET /users/:userId/visit-stats
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateCheckInWriteSchema, type CheckIn, type VisitStats } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { CheckInsService } from "./check-ins.service";

@Controller("check-ins")
export class CheckInsController {
  constructor(@Inject(CheckInsService) private readonly checkIns: CheckInsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<CheckIn> {
    const raw = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as { eventId?: unknown; placeId?: unknown }) : {};
    const parsed = CreateCheckInWriteSchema.safeParse({ eventId: raw.eventId, placeId: raw.placeId });
    if (!parsed.success) throw new BadRequestException("Invalid check-in payload");
    return this.checkIns.create(user.id, parsed.data);
  }
}

@Controller("users")
export class VisitStatsController {
  constructor(@Inject(CheckInsService) private readonly checkIns: CheckInsService) {}

  @Get(":userId/visit-stats")
  async stats(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) userId: string): Promise<VisitStats> {
    return this.checkIns.stats(userId, user.id);
  }
}
