import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { MaxInitDataUser } from "../auth/max-init-data";
import { UserEntity } from "./user.entity";
import { toUserDto, UsersService } from "./users.service";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key value"), { code: "23505" }));
}

function createRepo(initial: UserEntity[] = []) {
  const store: UserEntity[] = [...initial];
  const find = (where: { maxUserId: string }) => store.find((user) => user.maxUserId === where.maxUserId) ?? null;
  return {
    store,
    // Deferred reads/writes emulate driver I/O so concurrent upserts interleave like real queries.
    findOneBy: async (where: { maxUserId: string }) => {
      await tick();
      return find(where);
    },
    findOneByOrFail: async (where: { maxUserId: string }) => {
      await tick();
      const found = find(where);
      if (!found) throw new Error("UserEntity not found");
      return found;
    },
    create: (fields: Partial<UserEntity>) => ({ ...fields }) as UserEntity,
    merge: (target: UserEntity, fields: Partial<UserEntity>) => Object.assign(target, fields),
    save: async (entity: UserEntity) => {
      await tick();
      if (!store.includes(entity)) {
        if (store.some((user) => user.maxUserId === entity.maxUserId)) throw uniqueViolation();
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(store: UserEntity[] = []) {
  const repo = createRepo(store);
  const service = new UsersService(repo as unknown as Repository<UserEntity>);
  return { repo, service };
}

const maxUser: MaxInitDataUser = { id: 67890, first_name: "Max", last_name: "User", photo_url: null };

describe("UsersService.upsertFromMax", () => {
  it("creates the user on first sign-in", async () => {
    const { repo, service } = createService();
    const user = await service.upsertFromMax(maxUser);
    expect(user.maxUserId).toBe("67890");
    expect(user.firstName).toBe("Max");
    expect(user.lastName).toBe("User");
    expect(user.avatarUrl).toBeNull();
    expect(repo.store).toHaveLength(1);
  });

  it("is idempotent: a repeated sign-in creates no duplicate and writes nothing", async () => {
    const { repo, service } = createService();
    const first = await service.upsertFromMax(maxUser);
    const second = await service.upsertFromMax(maxUser);
    expect(repo.store).toHaveLength(1);
    expect(second).toBe(first);
  });

  it("updates profile fields on a later sign-in without creating a duplicate", async () => {
    const { repo, service } = createService();
    const first = await service.upsertFromMax(maxUser);
    const updated = await service.upsertFromMax({ ...maxUser, first_name: "Maxim", photo_url: "https://example.com/a.png" });
    expect(repo.store).toHaveLength(1);
    expect(updated.firstName).toBe("Maxim");
    expect(updated.avatarUrl).toBe("https://example.com/a.png");
    expect(updated).toBe(first);
  });

  it("survives a create-create race: concurrent first sign-ins both succeed and store one record", async () => {
    const { repo, service } = createService();
    const [a, b] = await Promise.all([service.upsertFromMax(maxUser), service.upsertFromMax(maxUser)]);
    expect(repo.store).toHaveLength(1);
    expect(b).toBe(a);
    expect(a.maxUserId).toBe("67890");
  });

  it("rethrows driver errors other than a unique violation", async () => {
    const repo = createRepo();
    const boom = new QueryFailedError("INSERT", [], Object.assign(new Error("connection lost"), { code: "08006" }));
    repo.save = async () => {
      throw boom;
    };
    const service = new UsersService(repo as unknown as Repository<UserEntity>);
    await expect(service.upsertFromMax(maxUser)).rejects.toBe(boom);
  });
});

describe("toUserDto", () => {
  it("maps the entity to the api-contracts User shape with ISO timestamps", () => {
    const entity: UserEntity = {
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
      maxUserId: "67890",
      firstName: "Max",
      lastName: null,
      avatarUrl: null,
      bannedFromPublishing: false,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    };
    expect(toUserDto(entity)).toEqual({
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
      maxUserId: "67890",
      firstName: "Max",
      lastName: null,
      username: null,
      avatarUrl: null,
      createdAt: "2026-09-01T07:00:00.000Z",
      updatedAt: "2026-09-01T07:00:00.000Z",
    });
  });
});
