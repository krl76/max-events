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

  it("serves a default profile for an unknown user", async () => {
    restore = installMockApi();

    const profile = await new ApiClient("/api").getProfile(DEMO_USER_ID);

    expect(profile).toEqual({ userId: DEMO_USER_ID, city: "Москва", interests: [], smartAlerts: DEFAULT_SMART_ALERTS, privacy: DEFAULT_PRIVACY });
  });

  it("applies a PATCH and persists it for the next GET", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile(DEMO_USER_ID, { city: "Казань", interests: ["бег", "джаз"] });
    expect(updated).toEqual({ userId: DEMO_USER_ID, city: "Казань", interests: ["бег", "джаз"], smartAlerts: DEFAULT_SMART_ALERTS, privacy: DEFAULT_PRIVACY });

    const reread = await api.getProfile(DEMO_USER_ID);
    expect(reread).toEqual(updated);
  });

  it("keeps a partial patch without touching other users", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile(DEMO_USER_ID, { city: "Казань" });
    expect(updated.interests).toEqual([]);

    const other = await api.getProfile("a0000000-0000-4000-8000-000000000002");
    expect(other.city).toBe("Москва");
    expect(other.interests).toEqual([]);
  });

  it("rejects an invalid patch body", async () => {
    restore = installMockApi();

    await expect(new ApiClient("/api").updateProfile(DEMO_USER_ID, { city: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
