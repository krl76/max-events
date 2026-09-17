// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for reports — create, open queue, resolve.
// SCOPE: POST /reports, GET /reports?status=open, POST /reports/:id/resolve.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./reports.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReportsController - create/list/resolve
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CreateReportWriteSchema, type Report } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Report> {
    const parsed = CreateReportWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid report payload");
    return this.reports.create(user.id, parsed.data);
  }

  @Get()
  list(@Query("status") status?: string): Promise<Report[]> {
    if (status !== undefined && status !== "open") throw new BadRequestException("Only status=open is supported");
    return this.reports.listOpen();
  }

  @Post(":id/resolve")
  resolve(@Param("id", ParseUUIDPipe) id: string): Promise<Report> {
    return this.reports.resolve(id);
  }
}
