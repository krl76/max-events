import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { MaxInitDataUser } from "../auth/max-init-data";
import { UserEntity } from "./user.entity";
import { photoUrlFromMax, toUserDto, UsersService } from "./users.service";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key value"), { code: "23505" }));
}

function createRepo(initial: UserEntity[] = []) {
  const store: UserEntity[] = [...initial];
  const find = (where: { maxUserId?: string; id?: string }) => store.find((user) => (where.maxUserId !== undefined ? user.maxUserId === where.maxUserId : user.id === where.id)) ?? null;
  return {
    store,
    // Deferred reads/writes emulate driver I/O so concurrent upserts interleave like real queries.
    findOneBy: async (where: { maxUserId?: string; id?: string }) => {
      await tick();
      return find(where);
    },
    findOneByOrFail: async (where: { maxUserId?: string; id?: string }) => {
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
    expect(user.username).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(repo.store).toHaveLength(1);
  });

  it("creates the user with the MAX username when provided", async () => {
    const { repo, service } = createService();
    const user = await service.upsertFromMax({ ...maxUser, username: "maxuser" });
    expect(user.username).toBe("maxuser");
    expect(repo.store).toHaveLength(1);
  });

  it("updates the username on a later sign-in when it changes", async () => {
    const { repo, service } = createService();
    const first = await service.upsertFromMax({ ...maxUser, username: "maxuser" });
    const updated = await service.upsertFromMax({ ...maxUser, username: "maxuser2" });
    expect(repo.store).toHaveLength(1);
    expect(updated.username).toBe("maxuser2");
    expect(updated).toBe(first);
  });

  it("clears the username when a later sign-in has none", async () => {
    const { repo, service } = createService();
    await service.upsertFromMax({ ...maxUser, username: "maxuser" });
    const updated = await service.upsertFromMax(maxUser);
    expect(repo.store).toHaveLength(1);
    expect(updated.username).toBeNull();
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

  it("does not wipe an existing avatar when a later sign-in omits photo_url", async () => {
    const { service } = createService();
    await service.upsertFromMax({ ...maxUser, photo_url: "https://example.com/a.png" });
    const again = await service.upsertFromMax({ ...maxUser, photo_url: null });
    expect(again.avatarUrl).toBe("https://example.com/a.png");
  });

  it("keeps an in-app avatar across a later MAX login that still carries photo_url", async () => {
    const { service } = createService();
    const created = await service.upsertFromMax({ ...maxUser, photo_url: "https://max.example/from-max.png" });
    created.id = "00000000-0000-4000-8000-00000000000a";
    await service.updateAvatar(created.id, "https://cdn.example.com/custom.jpg");
    const again = await service.upsertFromMax({ ...maxUser, photo_url: "https://max.example/from-max.png" });
    expect(again.avatarUrl).toBe("https://cdn.example.com/custom.jpg");
    expect(again.avatarCustom).toBe(true);
  });

  it("clears a custom avatar so the next MAX login restores photo_url", async () => {
    const { service } = createService();
    const created = await service.upsertFromMax({ ...maxUser, photo_url: "https://max.example/from-max.png" });
    created.id = "00000000-0000-4000-8000-00000000000a";
    await service.updateAvatar(created.id, "https://cdn.example.com/custom.jpg");
    await service.updateAvatar(created.id, null);
    const again = await service.upsertFromMax({ ...maxUser, photo_url: "https://max.example/from-max.png" });
    expect(again.avatarUrl).toBe("https://max.example/from-max.png");
    expect(again.avatarCustom).toBe(false);
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

describe("photoUrlFromMax", () => {
  it("keeps http(s) and site paths, turns protocol-relative into https, drops junk", () => {
    expect(photoUrlFromMax("https://i.oneme.ru/a.png")).toBe("https://i.oneme.ru/a.png");
    expect(photoUrlFromMax("http://i.oneme.ru/a.png")).toBe("http://i.oneme.ru/a.png");
    expect(photoUrlFromMax("//i.oneme.ru/a.png")).toBe("https://i.oneme.ru/a.png");
    expect(photoUrlFromMax("/api/uploads/1")).toBe("/api/uploads/1");
    expect(photoUrlFromMax("javascript:alert(1)")).toBeNull();
    expect(photoUrlFromMax("null")).toBeNull();
  });
});

describe("toUserDto", () => {
  it("maps the entity to the api-contracts User shape with ISO timestamps", () => {
    const entity: UserEntity = {
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
      maxUserId: "67890",
      firstName: "Max",
      lastName: null,
      username: "maxuser",
      avatarUrl: null,
      avatarCustom: false,
      bannedFromPublishing: false,
      friendsSyncedAt: null,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    };
    expect(toUserDto(entity)).toEqual({
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
      maxUserId: "67890",
      firstName: "Max",
      lastName: null,
      username: "maxuser",
      avatarUrl: null,
      createdAt: "2026-09-01T07:00:00.000Z",
      updatedAt: "2026-09-01T07:00:00.000Z",
    });
  });
});
