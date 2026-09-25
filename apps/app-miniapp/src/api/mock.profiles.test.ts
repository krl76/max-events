import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, resetMockProfiles } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("profile mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockProfiles();
  });

  it("serves a default profile for the demo user", async () => {
    restore = installMockApi();

    const profile = await new ApiClient("/api").getProfile();

    expect(profile).toEqual({ userId: DEMO_USER_ID, city: "Москва", interests: [], smartAlerts: DEFAULT_SMART_ALERTS, privacy: DEFAULT_PRIVACY, recommendationsEnabled: true, bio: "", coverUrl: null });
  });

  it("applies a PATCH and persists it for the next GET", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile({ city: "Казань", interests: ["бег", "джаз"], recommendationsEnabled: false });
    expect(updated).toEqual({ userId: DEMO_USER_ID, city: "Казань", interests: ["бег", "джаз"], smartAlerts: DEFAULT_SMART_ALERTS, privacy: DEFAULT_PRIVACY, recommendationsEnabled: false, bio: "", coverUrl: null });

    const reread = await api.getProfile();
    expect(reread).toEqual(updated);
  });

  it("keeps a partial patch without touching other fields", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile({ city: "Казань" });

    expect(updated.city).toBe("Казань");
    expect(updated.interests).toEqual([]);
    expect(updated.recommendationsEnabled).toBe(true);
  });

  it("rejects an invalid patch body", async () => {
    restore = installMockApi();

    await expect(new ApiClient("/api").updateProfile({ city: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
