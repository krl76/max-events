// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for page views and organizer stats.
// SCOPE: POST /views, GET /organizer/events/:id/stats?from&to.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth, ./stats.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ViewsController - POST /views
// - OrganizerStatsController - GET /organizer/events/:id/stats
// - parseStatsPeriod - from/to query into a StatsPeriod or 400
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { RecordPageViewWriteSchema, StatsPeriodSchema, type OrganizerEventStats, type StatsPeriod } from "@max-events/api-contracts";
import { CurrentOrganization, CurrentUser, OrganizerOnly } from "../auth/auth.guard";
import { OrganizationEntity } from "../organizations/organization.entity";

import { UserEntity } from "../users/user.entity";
import { StatsService } from "./stats.service";

@Controller("views")
export class ViewsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Post()
  async record(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<{ recorded: boolean }> {
    const parsed = RecordPageViewWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid view payload");
    return this.stats.recordView(user.id, parsed.data.targetType, parsed.data.targetId);
  }
}

@OrganizerOnly()
@Controller("organizer/events")
export class OrganizerStatsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Get(":id/stats")
  eventStats(@CurrentOrganization() organization: OrganizationEntity, @Param("id", ParseUUIDPipe) id: string, @Query("from") from?: string, @Query("to") to?: string): Promise<OrganizerEventStats> {
    return this.stats.eventStats(organization.id, id, parseStatsPeriod(from, to));
  }
}

export function parseStatsPeriod(from: string | undefined, to: string | undefined): StatsPeriod {
  const parsed = StatsPeriodSchema.safeParse({ from: from === undefined || from === "" ? null : from, to: to === undefined || to === "" ? null : to });
  if (!parsed.success) throw new BadRequestException("Invalid stats period");
  return parsed.data;
}
