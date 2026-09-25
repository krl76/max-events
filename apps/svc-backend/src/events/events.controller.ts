// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for events — authenticated CRUD and catalog list under /api/events.
// SCOPE: POST/GET/PATCH/DELETE; zod body validation (400); list query city/category/date/date_from/date_to/min_rating/q/sort/limit/offset; GET :id/details delegates to EventDetailsService with the current user.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./events.service, ./event-details.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventsController - /events CRUD, catalog list and the :id/details page aggregate
// - parseEventListQuery - coerce HTTP query into EventListQuery or 400
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateEventSchema, EventCategorySchema, TimestampSchema, type Event, type EventDetails } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { EventDetailsService } from "./event-details.service";
import { EVENT_LIST_MAX_LIMIT, EVENT_SORTS, EventsService, type EventListQuery, type EventSort } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(EventDetailsService) private readonly details: EventDetailsService,
  ) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Event> {
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid event payload");
    return this.events.create(parsed.data, user.id);
  }

  @Get()
  list(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<Event[]> {
    return this.events.list({ ...parseEventListQuery(query), viewerId: user.id });
  }

  @Get(":id/details")
  getDetails(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<EventDetails> {
    return this.details.get(id, user.id);
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
  const dateTo = parseOptionalTimestamp(query.date_to, true);
  const minRating = query.min_rating === undefined || query.min_rating === "" ? undefined : Number(query.min_rating);
  if (minRating !== undefined && (!Number.isInteger(minRating) || minRating < 1 || minRating > 5)) throw new BadRequestException("Invalid event query");
  const q = parseSearchNeedle(query.q);
  let sort: EventSort | undefined;
  if (query.sort !== undefined && query.sort !== "") {
    if (!(EVENT_SORTS as readonly string[]).includes(query.sort)) throw new BadRequestException("Invalid event query");
    sort = query.sort as EventSort;
  }
  const offset = query.offset === undefined || query.offset === "" ? undefined : Number(query.offset);
  const limit = query.limit === undefined || query.limit === "" ? undefined : Number(query.limit);
  if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) throw new BadRequestException("Invalid event query");
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > EVENT_LIST_MAX_LIMIT)) throw new BadRequestException("Invalid event query");
  const latRaw = query.lat;
  const lngRaw = query.lng;
  const hasLat = latRaw !== undefined && latRaw !== "";
  const hasLng = lngRaw !== undefined && lngRaw !== "";
  if (hasLat !== hasLng) throw new BadRequestException("Invalid event query");
  const latitude = hasLat ? Number(latRaw) : undefined;
  const longitude = hasLng ? Number(lngRaw) : undefined;
  if (latitude !== undefined && longitude !== undefined && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    throw new BadRequestException("Invalid event query");
  }
  return { city, category, date, dateFrom, dateTo, minRating, q, sort, limit, offset, latitude, longitude };
}

const SEARCH_NEEDLE_MAX = 200;

function parseSearchNeedle(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > SEARCH_NEEDLE_MAX) throw new BadRequestException("Invalid event query");
  return trimmed;
}

function parseOptionalTimestamp(value: string | undefined, endOfDay = false): Date | undefined {
  if (value === undefined || value === "") return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  const parsed = TimestampSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestException("Invalid event query");
  return new Date(parsed.data);
}
