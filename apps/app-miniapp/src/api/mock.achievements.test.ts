import { afterEach, describe, expect, it } from "vitest";
import { AchievementSchema } from "@max-events/api-contracts";
import type { VisitStats } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { achievementsFor, installMockApi, mockEvents, resetMockCheckIns } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

function stats(overrides: Partial<VisitStats> = {}): VisitStats {
  return { userId: DEMO_USER_ID, placesCount: 0, eventsCount: 0, byCategory: [], ...overrides };
}

describe("achievementsFor", () => {
  it("seed the four README achievements with zero progress for a fresh user", () => {
    const list = achievementsFor(stats());

    expect(list.map((item) => item.code)).toEqual(["city_explorer", "music_fan", "weekend_city", "volunteer"]);
    expect(list.map((item) => item.threshold)).toEqual([10, 5, 3, 5]);
    expect(list.every((item) => item.progress === 0 && item.grantedAt === null)).toBe(true);
  });

  it("derive progress from places and per-category counters", () => {
    const list = achievementsFor(
      stats({
        placesCount: 2,
        byCategory: [
          { category: "afisha", count: 2 },
          { category: "volunteering", count: 1 },
        ],
      }),
    );
    const byCode = new Map(list.map((item) => [item.code, item]));

    expect(byCode.get("city_explorer")!.progress).toBe(2);
    expect(byCode.get("music_fan")!.progress).toBe(2);
    expect(byCode.get("weekend_city")!.progress).toBe(2);
    expect(byCode.get("volunteer")!.progress).toBe(1);
    expect(list.every((item) => item.grantedAt === null)).toBe(true);
  });

  it("cap progress at the threshold and grant the achievement", () => {
    const list = achievementsFor(stats({ placesCount: 12, byCategory: [{ category: "afisha", count: 7 }] }));
    const byCode = new Map(list.map((item) => [item.code, item]));

    expect(byCode.get("city_explorer")!.progress).toBe(10);
    expect(byCode.get("city_explorer")!.grantedAt).not.toBeNull();
    expect(byCode.get("weekend_city")!.progress).toBe(3);
    expect(byCode.get("weekend_city")!.grantedAt).not.toBeNull();
    expect(byCode.get("music_fan")!.progress).toBe(5);
    expect(byCode.get("music_fan")!.grantedAt).not.toBeNull();
    expect(byCode.get("volunteer")!.grantedAt).toBeNull();
  });

  it("produce contract-valid entities", () => {
    expect(achievementsFor(stats({ placesCount: 10 })).every((item) => AchievementSchema.safeParse(item).success)).toBe(true);
  });
});

describe("achievements mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  it("reflect check-ins in the served progress", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await client.createCheckIn({ userId: DEMO_USER_ID, eventId: mockEvents[2].id });
    const list = await client.getAchievements(DEMO_USER_ID);
    const byCode = new Map(list.map((item) => [item.code, item]));

    expect(byCode.get("city_explorer")!.progress).toBe(1);
    expect(byCode.get("volunteer")!.progress).toBe(1);
    expect(byCode.get("music_fan")!.progress).toBe(0);
    expect(list.every((item) => AchievementSchema.safeParse(item).success)).toBe(true);
  });
});
