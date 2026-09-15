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

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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
      avatarUrl: payload.photo_url ?? null,
    };
    const existing = await this.users.findOneBy({ maxUserId });
    if (!existing) {
      return this.users.save(this.users.create({ maxUserId, ...fields }));
    }
    if (existing.firstName !== fields.firstName || existing.lastName !== fields.lastName || existing.avatarUrl !== fields.avatarUrl) {
      return this.users.save(this.users.merge(existing, fields));
    }
    return existing;
  }
}

export function toUserDto(user: UserEntity): User {
  return {
    id: user.id,
    maxUserId: user.maxUserId,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
