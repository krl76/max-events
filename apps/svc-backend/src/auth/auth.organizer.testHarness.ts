// Shared in-memory harness for organizer-auth tests: real AuthService over a fake Redis and a fake UserEntity repository.
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import type { Repository } from "typeorm";
import type { FriendsService } from "../friends/friends.service";
import type { UsersService } from "../users/users.service";
import { UserEntity } from "../users/user.entity";
import { AuthService } from "./auth.service";

export function createRedisFake() {
  const store = new Map<string, string>();
  const setCalls: { key: string; value: string; args: unknown[] }[] = [];
  return {
    store,
    setCalls,
    set: async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes("NX") && store.has(key)) return null;
      store.set(key, value);
      setCalls.push({ key, value, args });
      return "OK";
    },
    get: async (key: string) => store.get(key) ?? null,
    incr: async (key: string) => {
      const next = Number(store.get(key) ?? "0") + 1;
      store.set(key, String(next));
      return next;
    },
    del: async (...keys: string[]) => keys.reduce((removed, key) => removed + (store.delete(key) ? 1 : 0), 0),
  } as unknown as Redis & { store: Map<string, string>; setCalls: { key: string; value: string; args: unknown[] }[] };
}

export function createUserRepoFake(initial: UserEntity[] = []) {
  const store: UserEntity[] = [...initial];
  let seq = 0;
  const matches = (row: UserEntity, where: Partial<UserEntity>) => Object.entries(where).every(([key, value]) => row[key as keyof UserEntity] === value);
  const repo = {
    store,
    findOneBy: async (where: Partial<UserEntity>) => store.find((row) => matches(row, where)) ?? null,
    findOneByOrFail: async (where: Partial<UserEntity>) => {
      const found = store.find((row) => matches(row, where));
      if (!found) throw new Error("UserEntity not found");
      return found;
    },
    create: (fields: Partial<UserEntity>) => ({ ...fields }) as UserEntity,
    save: async (entity: UserEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
  return repo as unknown as Repository<UserEntity> & { store: UserEntity[] };
}

export function createOrganizerAuthService(config: Record<string, string>) {
  const redis = createRedisFake();
  const userRepo = createUserRepoFake();
  const users = {} as UsersService;
  const friends = { sync: async () => [] } as unknown as FriendsService;
  const service = new AuthService(new ConfigService(config), users, friends, redis, userRepo);
  return { service, redis, userRepo };
}
