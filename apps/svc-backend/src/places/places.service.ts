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
import { OrganizationsService } from "../organizations/organizations.service";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
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
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
  ) {}

  private async ownerFields(actorId?: string): Promise<{ organizerUserId: string | null; organizerOrganizationId: string | null }> {
    if (!actorId) return { organizerUserId: null, organizerOrganizationId: null };
    const asOrg = await this.organizations.findById(actorId);
    if (asOrg) return { organizerOrganizationId: asOrg.id, organizerUserId: asOrg.organizerUserId };
    const asUserOrg = await this.organizations.findByOrganizerUserId(actorId);
    return { organizerOrganizationId: asUserOrg?.id ?? null, organizerUserId: actorId };
  }

  async create(payload: CreatePlace, organizerUserId?: string, options?: { draft?: boolean }): Promise<Place> {
    const owner = await this.ownerFields(organizerUserId);
    if (owner.organizerUserId) await this.users.assertCanPublish(owner.organizerUserId);
    try {
      const saved = await this.places.save(this.places.create({ ...payload, published: options?.draft ? false : true, organizerUserId: owner.organizerUserId, organizerOrganizationId: owner.organizerOrganizationId }));
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
    if (actorId && isOrganizerOwner(found, actorId)) return;
    throw new NotFoundException("Place not found");
  }

  async update(id: string, patch: Partial<CreatePlace>, actorId?: string): Promise<Place> {
    const existing = await this.places.findOneBy({ id });
    if (!existing) throw new NotFoundException("Place not found");
    assertOrganizer(existing, actorId);
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
    assertOrganizer(existing, actorId);
    await this.places.delete({ id });
  }

  async listMine(actorId: string): Promise<Place[]> {
    const rows = await this.places.find({
      where: [{ organizerOrganizationId: actorId }, { organizerUserId: actorId }],
      order: { title: "ASC", id: "ASC" },
    });
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).map(toPlaceDto);
  }

  async publish(id: string, actorId: string): Promise<Place> {
    const owner = await this.ownerFields(actorId);
    if (owner.organizerUserId) await this.users.assertCanPublish(owner.organizerUserId);
    const existing = await this.places.findOneBy({ id });
    if (!existing) throw new NotFoundException("Place not found");
    assertOrganizer(existing, actorId);
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

function assertOrganizer(row: { organizerUserId?: string | null; organizerOrganizationId?: string | null }, actorId?: string): void {
  if (!isOrganizerOwner(row, actorId)) throw new ForbiddenException("Not the organizer");
}

function translateUniqueViolation(error: unknown): unknown {
  if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
    return new ConflictException("Place already exists");
  }
  return error;
}
