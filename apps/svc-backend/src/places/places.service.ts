// START_MODULE_CONTRACT
// PURPOSE: Place persistence — CRUD and filtered list mapped to api-contracts Place.
// SCOPE: Create/read/update/delete, unique (title, address, city) as 409, missing id as 404, list by city/category with limit/offset.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./place.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceListQuery - city/category/limit/offset
// - PlacesService - CRUD + list against PlaceEntity; GET list is Place[] for the miniapp client; resolveForEventBind allows own unpublished place as event FK
// - toPlaceDto - map PlaceEntity to the api-contracts Place shape
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { CreatePlace, Place, PlaceCategory } from "@max-events/api-contracts";
import { UsersService } from "../users/users.service";
import { PlaceEntity } from "./place.entity";

export type PlaceListQuery = {
  city?: string;
  category?: PlaceCategory;
  limit?: number;
  offset: number;
};

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(PlaceEntity)
    private readonly places: Repository<PlaceEntity>,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async create(payload: CreatePlace, organizerUserId?: string, options?: { draft?: boolean }): Promise<Place> {
    if (organizerUserId) await this.users.assertCanPublish(organizerUserId);
    try {
      const saved = await this.places.save(this.places.create({ ...payload, published: options?.draft ? false : true, organizerUserId: organizerUserId ?? null }));
      return toPlaceDto(saved);
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async getById(id: string): Promise<Place> {
    const found = await this.places.findOneBy({ id });
    if (!found || found.published === false) throw new NotFoundException("Place not found");
    return toPlaceDto(found);
  }

  async resolveForEventBind(id: string, actorId?: string): Promise<void> {
    const found = await this.places.findOneBy({ id });
    if (!found) throw new NotFoundException("Place not found");
    if (found.published !== false) return;
    if (actorId && found.organizerUserId === actorId) return;
    throw new NotFoundException("Place not found");
  }

  async update(id: string, patch: Partial<CreatePlace>, actorId?: string): Promise<Place> {
    const existing = await this.places.findOneBy({ id });
    if (!existing) throw new NotFoundException("Place not found");
    assertOrganizer(existing.organizerUserId, actorId);
    try {
      const saved = await this.places.save(this.places.merge(existing, patch));
      return toPlaceDto(saved);
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async unpublish(id: string): Promise<void> {
    const found = await this.places.findOneBy({ id });
    if (!found) throw new NotFoundException("Place not found");
    found.published = false;
    await this.places.save(found);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.places.findOneBy({ id });
    if (!existing) throw new NotFoundException("Place not found");
    assertOrganizer(existing.organizerUserId, actorId);
    await this.places.delete({ id });
  }

  async listMine(organizerUserId: string): Promise<Place[]> {
    const rows = await this.places.find({ where: { organizerUserId }, order: { title: "ASC", id: "ASC" } });
    return rows.map(toPlaceDto);
  }

  async publish(id: string, actorId: string): Promise<Place> {
    await this.users.assertCanPublish(actorId);
    const existing = await this.places.findOneBy({ id });
    if (!existing) throw new NotFoundException("Place not found");
    assertOrganizer(existing.organizerUserId, actorId);
    existing.published = true;
    return toPlaceDto(await this.places.save(existing));
  }

  async findByIds(ids: string[]): Promise<Place[]> {
    if (ids.length === 0) return [];
    const rows = await this.places.find({ where: { id: In(ids), published: true } });
    return rows.map(toPlaceDto);
  }

  async list(query: PlaceListQuery): Promise<Place[]> {
    const where: { published: true; city?: string; category?: PlaceCategory } = { published: true };
    if (query.city) where.city = query.city;
    if (query.category) where.category = query.category;
    const rows = await this.places.find({
      where,
      skip: query.offset,
      take: query.limit,
      order: { title: "ASC", id: "ASC" },
    });
    return rows.map(toPlaceDto);
  }
}

export function toPlaceDto(place: PlaceEntity): Place {
  return {
    id: place.id,
    title: place.title,
    address: place.address,
    city: place.city,
    category: place.category,
    latitude: place.latitude,
    longitude: place.longitude,
    published: place.published,
    logoUrl: place.logoUrl ?? null,
    createdAt: place.createdAt.toISOString(),
    updatedAt: place.updatedAt.toISOString(),
  };
}

function assertOrganizer(ownerId: string | null, actorId?: string): void {
  if (!actorId) return;
  if (!ownerId || ownerId !== actorId) throw new ForbiddenException("Not the organizer");
}

function translateUniqueViolation(error: unknown): unknown {
  if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
    return new ConflictException("Place already exists");
  }
  return error;
}
