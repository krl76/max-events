// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for event participation — authenticated set/get/delete and stats.
// SCOPE: PUT/GET/DELETE /events/:eventId/participation and GET .../stats; body { status }; CurrentUser identity.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./participations.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ParticipationsController - /events/:eventId/participation writes and stats
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Put } from "@nestjs/common";
import { ParticipationStatusWriteSchema, type Participation, type ParticipationStats } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { ParticipationsService } from "./participations.service";

@Controller("events/:eventId/participation")
export class ParticipationsController {
  constructor(@Inject(ParticipationsService) private readonly participations: ParticipationsService) {}

  @Get("stats")
  async stats(@CurrentUser() user: UserEntity, @Param("eventId", ParseUUIDPipe) eventId: string): Promise<ParticipationStats> {
    return this.participations.stats(user.id, eventId);
  }

  @Get()
  async getMine(@CurrentUser() user: UserEntity, @Param("eventId", ParseUUIDPipe) eventId: string): Promise<Participation> {
    return this.participations.getMine(user.id, eventId);
  }

  @Put()
  async set(
    @CurrentUser() user: UserEntity,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() body: unknown,
  ): Promise<Participation> {
    const parsed = ParticipationStatusWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid participation payload");
    return this.participations.set(user.id, eventId, parsed.data.status);
  }

  @Delete()
  async remove(@CurrentUser() user: UserEntity, @Param("eventId", ParseUUIDPipe) eventId: string): Promise<Participation> {
    return this.participations.remove(user.id, eventId);
  }
}
