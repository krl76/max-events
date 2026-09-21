// START_MODULE_CONTRACT
// PURPOSE: User persistence — idempotent upsert keyed by MAX user id.
// SCOPE: Upsert on login (create on first sign-in, refresh profile fields on later ones) and entity-to-contract mapping.
// DEPENDS: @nestjs/typeorm, typeorm, @max-events/api-contracts, ./user.entity, ../auth/max-init-data (types)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UsersService - upsertFromMax: find by maxUserId, create if absent, update only when profile fields changed
// - toUserDto - map UserEntity to the api-contracts User shape
// END_MODULE_MAP

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { User } from "@max-events/api-contracts";
import type { MaxInitDataUser } from "../auth/max-init-data";
import { UserEntity } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async upsertFromMax(payload: MaxInitDataUser): Promise<UserEntity> {
    const maxUserId = String(payload.id);
    const fields = {
      firstName: payload.first_name,
      lastName: payload.last_name ?? null,
      username: payload.username ?? null,
      avatarUrl: payload.photo_url ?? null,
    };
    const existing = await this.users.findOneBy({ maxUserId });
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
