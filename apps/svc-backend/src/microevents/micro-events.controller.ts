// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for micro-events — list, create, join, leave.
// SCOPE: GET/POST /micro-events, POST/DELETE /micro-events/:id/join.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventsController - list/create/join/leave
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateMicroEventWriteSchema, type MicroEvent } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { MicroEventsService } from "./micro-events.service";

@Controller("micro-events")
export class MicroEventsController {
  constructor(@Inject(MicroEventsService) private readonly microEvents: MicroEventsService) {}

  @Get()
  list(): Promise<MicroEvent[]> {
    return this.microEvents.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.microEvents.getCard(id);
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<MicroEvent> {
    const parsed = CreateMicroEventWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid micro-event payload");
    return this.microEvents.create(user.id, parsed.data);
  }

  @Post(":id/join")
  join(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<MicroEvent> {
    return this.microEvents.join(user.id, id);
  }

  @Delete(":id/join")
  leave(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<MicroEvent> {
    return this.microEvents.leave(user.id, id);
  }
}
