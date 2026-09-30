// START_MODULE_CONTRACT
// PURPOSE: User persistence — idempotent upsert keyed by MAX user id.
// SCOPE: Upsert on login (create on first sign-in, refresh profile fields on later ones) and entity-to-contract mapping.
// DEPENDS: @nestjs/typeorm, typeorm, @max-events/api-contracts, ./user.entity, ../auth/max-init-data (types)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UsersService - upsertFromMax: find by maxUserId, create if absent, update only when profile fields changed
// - UsersService.updateAvatar - in-app avatar; null clears avatarCustom so the next upsert restores photo_url
// - photoUrlFromMax - keep a usable MAX photo, drop javascript: and empty values so first login still inserts
// - toUserDto - map UserEntity to the api-contracts User shape
// END_MODULE_MAP

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { User } from "@max-events/api-contracts";
import type { MaxInitDataUser } from "../auth/max-init-data";
import { UserEntity } from "./user.entity";

/** Drop javascript: and other junk MAX sometimes puts in photo_url so the first login still inserts. */
export function photoUrlFromMax(url: string | null | undefined): string | null {
  if (url == null) return null;
  const value = url.trim();
  if (value === "" || value === "null") return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async upsertFromMax(payload: MaxInitDataUser): Promise<UserEntity> {
    const maxUserId = String(payload.id);
    const existing = await this.users.findOneBy({ maxUserId });
    const fields = {
      firstName: payload.first_name,
      lastName: payload.last_name ?? null,
      username: payload.username ?? null,
      avatarUrl: existing?.avatarCustom ? existing.avatarUrl : photoUrlFromMax(payload.photo_url) || existing?.avatarUrl || null,
    };
    if (!existing) {
      try {
        return await this.users.save(this.users.create({ maxUserId, ...fields }));
      } catch (error) {
        // Concurrent first sign-in lost the insert race: the winner's row is now visible.
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          return this.users.findOneByOrFail({ maxUserId });
        }
        throw error;
      }
    }
    if (existing.firstName !== fields.firstName || existing.lastName !== fields.lastName || existing.username !== fields.username || existing.avatarUrl !== fields.avatarUrl) {
      return this.users.save(this.users.merge(existing, fields));
    }
    return existing;
  }

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (ids.length === 0) return [];
    return this.users.find({ where: { id: In(ids) } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ id });
  }

  /**
   * In-app avatar. Null clears a custom pick and lets the next MAX login restore the messenger photo.
   * A non-null value sticks: upsertFromMax must not overwrite it with photo_url.
   */
  async updateAvatar(userId: string, avatarUrl: string | null): Promise<UserEntity> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    user.avatarUrl = avatarUrl;
    user.avatarCustom = avatarUrl !== null;
    return this.users.save(user);
  }

  async assertCanPublish(userId: string): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    if (user.bannedFromPublishing) throw new ForbiddenException("Organizer is banned from publishing");
  }

  async banFromPublishing(userId: string): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    user.bannedFromPublishing = true;
    await this.users.save(user);
  }
}

export function toUserDto(user: UserEntity): User {
  return {
    id: user.id,
    maxUserId: user.maxUserId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
