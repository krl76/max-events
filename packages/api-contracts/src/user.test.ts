import { describe, expect, it } from "vitest";
import { CreateUserSchema, DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, ProfileSchema, UpdateAppSettingsSchema, UpdateProfileSchema, UserSchema } from "./user.js";

const validUser = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  maxUserId: "max-user-42",
  firstName: "Дима",
  createdAt: "2026-09-01T10:00:00+03:00",
  updatedAt: "2026-09-01T10:00:00+03:00",
};

describe("UserSchema", () => {
  it("accepts a minimal user and applies defaults", () => {
    const parsed = UserSchema.parse(validUser);
    expect(parsed.lastName).toBeNull();
    expect(parsed.avatarUrl).toBeNull();
  });

  it("rejects a user without MAX identity", () => {
    expect(UserSchema.safeParse({ ...validUser, maxUserId: "" }).success).toBe(false);
  });

  it("accepts an in-app JPEG data URL as the avatar, the way a picked photo travels until storage lands", () => {
    const parsed = UserSchema.parse({ ...validUser, avatarUrl: "data:image/jpeg;base64,abc" });
    expect(parsed.avatarUrl).toBe("data:image/jpeg;base64,abc");
    expect(UserSchema.safeParse({ ...validUser, avatarUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("CreateUserSchema", () => {
  it("does not require id or timestamps", () => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = validUser;
    expect(CreateUserSchema.safeParse(payload).success).toBe(true);
  });
});

describe("ProfileSchema", () => {
  it("applies empty interests and enabled smart alerts by default", () => {
    const parsed = ProfileSchema.parse({ userId: validUser.id, city: "Москва" });
    expect(parsed.interests).toEqual([]);
    expect(parsed.smartAlerts).toEqual(DEFAULT_SMART_ALERTS);
    expect(parsed.privacy).toEqual(DEFAULT_PRIVACY);
    expect(parsed.recommendationsEnabled).toBe(true);
    expect(parsed.bio).toBe("");
    expect(parsed.coverUrl).toBeNull();
  });

  it("rejects a blank city and blank interests", () => {
    expect(ProfileSchema.safeParse({ userId: validUser.id, city: "" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ userId: validUser.id, city: "Москва", interests: [""] }).success).toBe(false);
  });
});

describe("UpdateProfileSchema", () => {
  it("accepts partial profile edits without userId", () => {
    expect(UpdateProfileSchema.safeParse({ city: "Казань" }).success).toBe(true);
    expect(UpdateProfileSchema.parse({ smartAlerts: { weather: false } }).smartAlerts).toEqual({ weather: false });
    expect(UpdateProfileSchema.safeParse({ smartAlerts: { quietHoursEnabled: true, quietHoursFrom: "22:00" } }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ smartAlerts: { quietHoursFrom: "25:00" } }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ privacy: { visitHistory: "hidden" } }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ privacy: { routes: "close" } }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ privacy: { routes: "city" } }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ recommendationsEnabled: false }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ bio: "Люблю джаз и падел" }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ coverUrl: null, avatarUrl: "https://cdn.example.com/a.jpg" }).success).toBe(true);
  });

  it("rejects a bio over the Instagram-like cap and a non-image cover", () => {
    expect(UpdateProfileSchema.safeParse({ bio: "x".repeat(151) }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ coverUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("UpdateAppSettingsSchema", () => {
  it("keeps omitted keys omitted instead of filling defaults", () => {
    const parsed = UpdateAppSettingsSchema.parse({ quietHours: true });
    expect(parsed).toEqual({ quietHours: true });
    expect("searchRadiusKm" in parsed).toBe(false);
  });

  it("rejects a broken quiet-hours clock", () => {
    expect(UpdateAppSettingsSchema.safeParse({ quietHoursFrom: "25:00" }).success).toBe(false);
  });
});
