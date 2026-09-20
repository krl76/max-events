// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for reports — create, open queue, resolve.
// SCOPE: POST /reports, POST /reports/spot-check (moderator), GET /reports?status=open, POST /reports/:id/resolve.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./reports.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReportsController - create/spot-check/list/resolve
// - ModerationController - unpublish and ban
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { BanOrganizerWriteSchema, CreateReportWriteSchema, UnpublishWriteSchema, type Report } from "@max-events/api-contracts";
import { ConfigService } from "@nestjs/config";
import { CurrentUser } from "../auth/auth.guard";
import { assertModerator } from "../auth/moderators";
import { UserEntity } from "../users/user.entity";
import { ModerationService } from "./moderation.service";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Report> {
    const parsed = CreateReportWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid report payload");
    return this.reports.create(user.id, parsed.data);
  }

  @Post("spot-check")
  async spotCheck(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Report> {
    assertModerator(this.config, user);
    const parsed = CreateReportWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid report payload");
    return this.reports.spotCheck(user.id, parsed.data);
  }

  @Get()
  list(@CurrentUser() user: UserEntity, @Query("status") status?: string): Promise<Report[]> {
    assertModerator(this.config, user);
    if (status !== undefined && status !== "open") throw new BadRequestException("Only status=open is supported");
    return this.reports.listOpen();
  }

  @Post(":id/resolve")
  resolve(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Report> {
    assertModerator(this.config, user);
    return this.reports.resolve(id);
  }
}

@Controller("moderation")
export class ModerationController {
  constructor(
    @Inject(ModerationService) private readonly moderation: ModerationService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post("unpublish")
  async unpublish(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<{ ok: true }> {
    assertModerator(this.config, user);
    const parsed = UnpublishWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid unpublish payload");
    await this.moderation.unpublish(parsed.data.targetType, parsed.data.targetId);
    return { ok: true };
  }

  @Post("ban")
  async ban(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<{ ok: true }> {
    assertModerator(this.config, user);
    const parsed = BanOrganizerWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid ban payload");
    await this.moderation.banOrganizer(parsed.data.userId);
    return { ok: true };
  }
}
