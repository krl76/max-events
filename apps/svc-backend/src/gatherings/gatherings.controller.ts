// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for friend availability and gatherings.
// SCOPE: GET /friends/availability?eventId=, POST/GET /gatherings, PATCH /gatherings/:id/response; CurrentUser identity.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./gatherings.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendAvailabilityController - GET /friends/availability
// - GatheringsController - POST/GET gatherings and PATCH response
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateGatheringSchema, GatheringResponseWriteSchema, type FriendAvailability, type Gathering } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { GatheringsService } from "./gatherings.service";

@Controller("friends")
export class FriendAvailabilityController {
  constructor(@Inject(GatheringsService) private readonly gatherings: GatheringsService) {}

  @Get("availability")
  async availability(@CurrentUser() user: UserEntity, @Query("eventId") eventId?: string): Promise<FriendAvailability[]> {
    const parsed = eventId ? ParseUuid(eventId) : null;
    if (!parsed) throw new BadRequestException("Invalid availability query");
    return this.gatherings.availability(user.id, parsed);
  }
}

@Controller("gatherings")
export class GatheringsController {
  constructor(@Inject(GatheringsService) private readonly gatherings: GatheringsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Gathering> {
    const parsed = CreateGatheringSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid gathering payload");
    return this.gatherings.create(user.id, parsed.data);
  }

  @Get(":id")
  async get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Gathering> {
    return this.gatherings.get(user.id, id);
  }

  @Patch(":id/response")
  async respond(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Gathering> {
    const parsed = GatheringResponseWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid gathering payload");
    return this.gatherings.respond(user.id, id, parsed.data.response);
  }
}

function ParseUuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
