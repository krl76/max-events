import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { DEFAULT_SMART_ALERTS } from "@max-events/api-contracts";
import { ProfileEntity } from "./profile.entity";
import { DEFAULT_PROFILE_CITY, ProfilesService, toProfileDto } from "./profiles.service";

const userId = "00000000-0000-4000-8000-00000000000a";

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key value"), { code: "23505" }));
}

function createRepo(initial: ProfileEntity[] = []) {
  const store: ProfileEntity[] = [...initial];
  const now = () => new Date("2026-09-01T07:00:00Z");
  return {
    store,
    create: (fields: Partial<ProfileEntity>) => ({ ...fields, interests: fields.interests ? [...fields.interests] : [] }) as ProfileEntity,
    merge: (target: ProfileEntity, fields: Partial<ProfileEntity>) => Object.assign(target, fields),
    save: async (entity: ProfileEntity) => {
      if (!store.includes(entity)) {
        if (store.some((row) => row.userId === entity.userId)) throw uniqueViolation();
        entity.updatedAt ??= now();
        store.push(entity);
      } else {
        entity.updatedAt = now();
      }
      return entity;
    },
    findOneBy: async (where: { userId: string }) => store.find((row) => row.userId === where.userId) ?? null,
    findOneByOrFail: async (where: { userId: string }) => {
      const found = store.find((row) => row.userId === where.userId);
      if (!found) throw new Error("ProfileEntity not found");
      return found;
    },
  };
}

function createService(store: ProfileEntity[] = []) {
  const repo = createRepo(store);
  const service = new ProfilesService(repo as unknown as Repository<ProfileEntity>);
  return { repo, service };
}

describe("ProfilesService", () => {
  it("creates a default profile on first read", async () => {
    const { repo, service } = createService();
    const profile = await service.getOrCreate(userId);
    expect(profile).toEqual({ userId, city: DEFAULT_PROFILE_CITY, interests: [], smartAlerts: DEFAULT_SMART_ALERTS });
    expect(repo.store).toHaveLength(1);
  });

  it("returns the existing profile without writing on a later read", async () => {
    const { repo, service } = createService();
    const first = await service.getOrCreate(userId);
    const second = await service.getOrCreate(userId);
    expect(second).toEqual(first);
    expect(repo.store).toHaveLength(1);
  });

  it("patches only provided fields", async () => {
    const { service } = createService();
    await service.getOrCreate(userId);
    const cityOnly = await service.update(userId, { city: "Казань" });
    expect(cityOnly).toEqual({ userId, city: "Казань", interests: [], smartAlerts: DEFAULT_SMART_ALERTS });
    const withInterests = await service.update(userId, { interests: ["бег", "джаз"] });
    expect(withInterests).toEqual({ userId, city: "Казань", interests: ["бег", "джаз"], smartAlerts: DEFAULT_SMART_ALERTS });
    const alerts = await service.update(userId, { smartAlerts: { weather: false } });
    expect(alerts.smartAlerts).toEqual({ ...DEFAULT_SMART_ALERTS, weather: false });
  });

  it("survives a create-create race on first GET", async () => {
    const { repo, service } = createService();
    const [a, b] = await Promise.all([service.getOrCreate(userId), service.getOrCreate(userId)]);
    expect(repo.store).toHaveLength(1);
    expect(a).toEqual(b);
  });
});

describe("toProfileDto", () => {
  it("copies interests so callers cannot mutate the entity array", () => {
    const entity: ProfileEntity = { userId, city: "Москва", interests: ["джаз"], smartAlerts: { ...DEFAULT_SMART_ALERTS }, updatedAt: new Date("2026-09-01T07:00:00Z") };
    const dto = toProfileDto(entity);
    dto.interests.push("рок");
    expect(entity.interests).toEqual(["джаз"]);
  });
});
