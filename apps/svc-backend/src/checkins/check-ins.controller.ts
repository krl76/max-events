// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for check-ins and visit stats.
// SCOPE: POST /check-ins; GET /check-in-codes; POST /organizer/events/:id/check-ins; GET /users/:userId/visit-stats for CurrentUser only.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./check-ins.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CheckInsController - POST /check-ins
// - CheckInCodesController - GET /check-in-codes
// - OrganizerCheckInsController - POST /organizer/events/:id/check-ins
// - VisitStatsController - GET /users/:userId/visit-stats
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateCheckInWriteSchema, type CheckIn, type VisitStats } from "@max-events/api-contracts";
import { CurrentOrganization, CurrentUser, OrganizerOnly } from "../auth/auth.guard";
import { OrganizationEntity } from "../organizations/organization.entity";
import { UserEntity } from "../users/user.entity";
import { CheckInsService, type CheckInCode, type OrganizerGuestCheckIn } from "./check-ins.service";

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

@Controller("check-in-codes")
export class CheckInCodesController {
  constructor(@Inject(CheckInsService) private readonly checkIns: CheckInsService) {}

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<CheckInCode[]> {
    return this.checkIns.listCodes(user.id);
  }
}

@OrganizerOnly()
@Controller("organizer/events")
export class OrganizerCheckInsController {
  constructor(@Inject(CheckInsService) private readonly checkIns: CheckInsService) {}

  @Post(":id/check-ins")
  async checkIn(@CurrentOrganization() organization: OrganizationEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<OrganizerGuestCheckIn> {
    const code = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as { code?: unknown }).code : undefined;
    if (typeof code !== "string") throw new BadRequestException("Invalid check-in code");
    return this.checkIns.checkInByCode(organization.id, id, code);
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
