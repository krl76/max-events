import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { VisitStats } from "@max-events/api-contracts";
import type { CheckInsService } from "../checkins/check-ins.service";
import { UserAchievementEntity } from "./user-achievement.entity";
import { achievementsFromStats, AchievementsService, ACHIEVEMENT_CATALOG } from "./achievements.service";

const userId = "00000000-0000-4000-8000-00000000000a";
const otherUser = "00000000-0000-4000-8000-00000000000b";
const now = new Date("2026-09-12T10:00:00Z");

function stats(overrides: Partial<VisitStats> = {}): VisitStats {
  return { userId, placesCount: 0, eventsCount: 0, byCategory: [], ...overrides };
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

describe("achievementsFromStats", () => {
  it("returns four README achievements at zero without grants", () => {
    const list = achievementsFromStats(stats(), new Map());
    expect(list.map((item) => item.code)).toEqual(ACHIEVEMENT_CATALOG.map((item) => item.code));
    expect(list.map((item) => item.threshold)).toEqual([10, 5, 3, 5]);
    expect(list.every((item) => item.progress === 0 && item.grantedAt === null)).toBe(true);
  });

  it("caps progress at the threshold and keeps an existing grant", () => {
    const granted = new Date("2026-09-01T00:00:00Z");
    const list = achievementsFromStats(
      stats({ placesCount: 12, byCategory: [{ category: "afisha", count: 7 }] }),
      new Map([["city_explorer", granted]]),
    );
    const byCode = new Map(list.map((item) => [item.code, item]));
    expect(byCode.get("city_explorer")?.progress).toBe(10);
    expect(byCode.get("city_explorer")?.grantedAt).toBe(granted.toISOString());
    expect(byCode.get("music_fan")?.progress).toBe(5);
    expect(byCode.get("music_fan")?.grantedAt).toBeNull();
    expect(byCode.get("weekend_city")?.progress).toBe(3);
  });
});

describe("AchievementsService", () => {
  it("grants on first crossing and keeps grantedAt on a second read", async () => {
    const grants = createStoreRepo<UserAchievementEntity>();
    const checkIns = {
      stats: async () => stats({ placesCount: 10, byCategory: [{ category: "volunteering", count: 5 }] }),
    } as unknown as CheckInsService;
    const service = new AchievementsService(grants as unknown as Repository<UserAchievementEntity>, checkIns);
    const first = await service.list(userId, userId, now);
    const city = first.find((item) => item.code === "city_explorer")!;
    const volunteer = first.find((item) => item.code === "volunteer")!;
    expect(city.grantedAt).toBe(now.toISOString());
    expect(volunteer.grantedAt).toBe(now.toISOString());
    expect(grants.store).toHaveLength(3);
    const second = await service.list(userId, userId, new Date("2026-09-13T00:00:00Z"));
    expect(second.find((item) => item.code === "city_explorer")?.grantedAt).toBe(now.toISOString());
  });

  it("forbids reading another user's achievements", async () => {
    const grants = createStoreRepo<UserAchievementEntity>();
    const checkIns = { stats: async () => stats() } as unknown as CheckInsService;
    const service = new AchievementsService(grants as unknown as Repository<UserAchievementEntity>, checkIns);
    await expect(service.list(otherUser, userId, now)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
