// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the current user's calendar — GET /api/calendar.
// SCOPE: Authenticated calendar split into upcoming/past sections.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./calendar.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarController - GET /calendar
// END_MODULE_MAP

import { Controller, Get, Inject } from "@nestjs/common";
import type { CalendarResponse } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(@Inject(CalendarService) private readonly calendar: CalendarService) {}

  @Get()
  list(@CurrentUser() user: UserEntity): Promise<CalendarResponse> {
    return this.calendar.list(user.id);
  }
}
