// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the current user's calendar — GET /api/calendar and the shared-calendar routes.
// SCOPE: Authenticated calendar split into upcoming/past; optional from/to; GET/POST/DELETE /calendar/shared*.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./calendar.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarController - GET /calendar, GET /calendar/shared, POST peers/accept/going, DELETE peer
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { AcceptCalendarInviteWriteSchema, AddCalendarPeerWriteSchema, type CalendarResponse, type SharedCalendar } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { CalendarService, parseCalendarRange } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(@Inject(CalendarService) private readonly calendar: CalendarService) {}

  @Get("shared")
  async shared(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>, @Req() req: { headers: { host?: string } }): Promise<SharedCalendar> {
    return this.calendar.shared(user.id, parseCalendarRange(query), req.headers.host ?? null);
  }

  @Post("shared/peers")
  async addPeer(@CurrentUser() user: UserEntity, @Body() body: unknown, @Req() req: { headers: { host?: string } }): Promise<SharedCalendar> {
    const parsed = AddCalendarPeerWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid calendar payload");
    return this.calendar.addPeer(user.id, parsed.data.userId, parsed.data.canEdit ?? true, req.headers.host ?? null);
  }

  @Delete("shared/peers/:userId")
  async revokePeer(@CurrentUser() user: UserEntity, @Param("userId", ParseUUIDPipe) peerId: string, @Req() req: { headers: { host?: string } }): Promise<SharedCalendar> {
    return this.calendar.revokePeer(user.id, peerId, req.headers.host ?? null);
  }

  @Post("shared/accept")
  async acceptInvite(@CurrentUser() user: UserEntity, @Body() body: unknown, @Req() req: { headers: { host?: string } }): Promise<SharedCalendar> {
    const parsed = AcceptCalendarInviteWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid calendar payload");
    return this.calendar.acceptInvite(user.id, parsed.data.token, req.headers.host ?? null);
  }

  @Post("shared/entries/:id/going")
  async going(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) bookingId: string, @Req() req: { headers: { host?: string } }): Promise<SharedCalendar> {
    return this.calendar.going(user.id, bookingId, req.headers.host ?? null);
  }

  @Get()
  async list(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<CalendarResponse> {
    return this.calendar.list(user.id, new Date(), parseCalendarRange(query));
  }
}
