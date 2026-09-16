import { describe, expect, it } from "vitest";
import { AchievementCodeSchema, AchievementSchema } from "./achievement.js";

describe("AchievementCodeSchema", () => {
  it("accepts the README achievement codes", () => {
    const codes = ["city_explorer", "music_fan", "weekend_city", "volunteer"];
    for (const code of codes) {
      expect(AchievementCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("rejects an unknown code", () => {
    expect(AchievementCodeSchema.safeParse("party_animal").success).toBe(false);
  });
});

describe("AchievementSchema", () => {
  it("accepts an in-progress achievement: «Исследователь города» (10 новых мест), 7/10", () => {
    const achievement = { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: 7, grantedAt: null };
    expect(AchievementSchema.parse(achievement)).toEqual(achievement);
  });

  it("accepts a granted achievement with a grant date", () => {
    const achievement = { code: "music_fan", title: "Музыкальный фанат", threshold: 5, progress: 5, grantedAt: "2026-09-11T12:00:00+03:00" };
    expect(AchievementSchema.parse(achievement)).toEqual(achievement);
  });

  it("rejects progress above the threshold", () => {
    const achievement = { code: "weekend_city", title: "Город за выходные", threshold: 3, progress: 4, grantedAt: null };
    expect(AchievementSchema.safeParse(achievement).success).toBe(false);
  });

  it("defaults progress to zero", () => {
    const achievement = { code: "volunteer", title: "Волонтер", threshold: 5, grantedAt: null };
    expect(AchievementSchema.parse(achievement).progress).toBe(0);
  });

  it("round-trips through JSON", () => {
    const achievement = { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: 7, grantedAt: null };
    const parsed = AchievementSchema.parse(achievement);
    expect(AchievementSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
