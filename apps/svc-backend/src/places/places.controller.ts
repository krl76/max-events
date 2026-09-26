// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for places — authenticated CRUD and filtered list under /api/places.
// SCOPE: POST/GET/PATCH/DELETE; zod body validation (400); list query city/category/q/limit/offset.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./places.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacesController - /places CRUD and list
// - parseListQuery - coerce HTTP query into PlaceListQuery or 400
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreatePlaceSchema, PlaceCategorySchema, type Place } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { PlacesService, type PlaceListQuery } from "./places.service";

@Controller("places")
export class PlacesController {
  constructor(@Inject(PlacesService) private readonly places: PlacesService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Place> {
    const parsed = CreatePlaceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid place payload");
    return this.places.create(parsed.data, user.id);
  }

  @Get()
  list(@Query() query: Record<string, string | undefined>): Promise<Place[]> {
    return this.places.list(parseListQuery(query));
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string): Promise<Place> {
    return this.places.getById(id);
  }

  @Patch(":id")
  async update(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Place> {
    const parsed = CreatePlaceSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid place payload");
    return this.places.update(id, parsed.data, user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.places.remove(id, user.id);
  }
}

export function parseListQuery(query: Record<string, string | undefined>): PlaceListQuery {
  const city = query.city && query.city.length > 0 ? query.city : undefined;
  let category: PlaceListQuery["category"];
  if (query.category !== undefined && query.category !== "") {
    const parsed = PlaceCategorySchema.safeParse(query.category);
    if (!parsed.success) throw new BadRequestException("Invalid place query");
    category = parsed.data;
  }
  const offset = query.offset === undefined || query.offset === "" ? 0 : Number(query.offset);
  const limit = query.limit === undefined || query.limit === "" ? undefined : Number(query.limit);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new BadRequestException("Invalid place query");
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    throw new BadRequestException("Invalid place query");
  }
  const q = parseSearchNeedle(query.q);
  return { city, category, q, limit, offset };
}

const SEARCH_NEEDLE_MAX = 200;

function parseSearchNeedle(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > SEARCH_NEEDLE_MAX) throw new BadRequestException("Invalid place query");
  return trimmed;
}
