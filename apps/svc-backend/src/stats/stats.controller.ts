// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for page views and organizer stats.
// SCOPE: POST /views, GET /organizer/events/:id/stats.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth, ./stats.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ViewsController - POST /views
// - OrganizerStatsController - GET /organizer/events/:id/stats
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { RecordPageViewWriteSchema, type OrganizerEventStats } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
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

@Controller("organizer/events")
export class OrganizerStatsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Get(":id/stats")
  eventStats(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<OrganizerEventStats> {
    return this.stats.eventStats(user.id, id);
  }
}
