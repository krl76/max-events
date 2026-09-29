import { afterEach, describe, expect, it } from "vitest";
import { CityWalkSchema, type ComposeCityWalkWrite } from "@max-events/api-contracts";
import { ApiClient, ApiError } from "./client";
import { installMockApi } from "./mock";
import { resetMockWalks } from "./mock/walks";

const write: ComposeCityWalkWrite = {
  city: "Москва",
  durationMinutes: 180,
  budgetMode: "any",
  budgetRub: null,
  interests: ["parks"],
  excludeKeys: [],
};

describe("city walk mock", () => {
  afterEach(() => {
    resetMockWalks();
  });

  it("parses a composed walk", async () => {
    const restore = installMockApi();
    try {
      const walk = await new ApiClient().composeCityWalk(write);
      expect(CityWalkSchema.safeParse(walk).success).toBe(true);
      expect(walk.city).toBe("Москва");
      expect(walk.stops).toHaveLength(2);
      expect(walk.stops[0]?.title).toBe("Парк Горького");
    } finally {
      restore();
    }
  });

  it("rejects an unknown walk", async () => {
    const restore = installMockApi();
    try {
      const pending = new ApiClient().getCityWalk("00000000-0000-4000-8000-000000000099");
      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status: 404 });
    } finally {
      restore();
    }
  });

  it("rejects a city with no sights", async () => {
    const restore = installMockApi();
    try {
      const pending = new ApiClient().composeCityWalk({ ...write, city: "Пусто" });
      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status: 422 });
    } finally {
      restore();
    }
  });
});
