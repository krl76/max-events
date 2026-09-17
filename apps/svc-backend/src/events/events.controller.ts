// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for events — authenticated CRUD and catalog list under /api/events.
// SCOPE: POST/GET/PATCH/DELETE; zod body validation (400); list query city/category/date/date_from/date_to.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./events.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventsController - /events CRUD and catalog list
// - parseEventListQuery - coerce HTTP query into EventListQuery or 400
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateEventSchema, EventCategorySchema, TimestampSchema, type Event } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { EventsService, type EventListQuery } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Event> {
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid event payload");
    return this.events.create(parsed.data, user.id);
  }

  @Get()
  list(@Query() query: Record<string, string | undefined>): Promise<Event[]> {
    return this.events.list(parseEventListQuery(query));
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string): Promise<Event> {
    return this.events.getById(id);
  }

  @Patch(":id")
  async update(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Event> {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("Invalid event payload");
    }
    return this.events.update(id, body as Record<string, unknown>, user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.events.remove(id, user.id);
  }
}

export function parseEventListQuery(query: Record<string, string | undefined>): EventListQuery {
  const city = query.city && query.city.length > 0 ? query.city : undefined;
  let category: EventListQuery["category"];
  if (query.category !== undefined && query.category !== "") {
    const parsed = EventCategorySchema.safeParse(query.category);
    if (!parsed.success) throw new BadRequestException("Invalid event query");
    category = parsed.data;
  }
  let date: string | undefined;
  if (query.date !== undefined && query.date !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) throw new BadRequestException("Invalid event query");
    date = query.date;
  }
  const dateFrom = parseOptionalTimestamp(query.date_from);
  const dateTo = parseOptionalTimestamp(query.date_to);
  return { city, category, date, dateFrom, dateTo };
}

function parseOptionalTimestamp(value: string | undefined): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = TimestampSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestException("Invalid event query");
  return new Date(parsed.data);
}
