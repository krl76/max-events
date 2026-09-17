// START_MODULE_CONTRACT
// PURPOSE: Place persistence — CRUD and filtered list mapped to api-contracts Place.
// SCOPE: Create/read/update/delete, unique (title, address, city) as 409, missing id as 404, list by city/category with limit/offset.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ./place.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceListQuery - city/category/limit/offset
// - PlacesService - CRUD + list against PlaceEntity; GET list is Place[] for the miniapp client
// - toPlaceDto - map PlaceEntity to the api-contracts Place shape
// END_MODULE_MAP

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
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

  async create(payload: CreatePlace, organizerUserId?: string): Promise<Place> {
    if (organizerUserId) await this.users.assertCanPublish(organizerUserId);
    try {
      const saved = await this.places.save(this.places.create({ ...payload, published: true }));
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

  async update(id: string, patch: Partial<CreatePlace>): Promise<Place> {
    const existing = await this.places.findOneBy({ id });
    if (!existing) throw new NotFoundException("Place not found");
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

  async remove(id: string): Promise<void> {
    const result = await this.places.delete({ id });
    if (!result.affected) throw new NotFoundException("Place not found");
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
    createdAt: place.createdAt.toISOString(),
    updatedAt: place.updatedAt.toISOString(),
  };
}

function translateUniqueViolation(error: unknown): unknown {
  if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
    return new ConflictException("Place already exists");
  }
  return error;
}
