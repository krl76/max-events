import { describe, expect, it } from "vitest";
import type { TodayResponse } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { parseOrigin, TodayController } from "./today.controller";
import type { GeoOrigin, TodayService } from "./today.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const response: TodayResponse = { summary: { nearbyCount: 0, suitableCount: 0, withFriendsCount: 0 }, cards: [] };

describe("parseOrigin", () => {
  it("returns null when geo is omitted and 400 when it is invalid", () => {
    expect(parseOrigin({})).toBeNull();
    expect(() => parseOrigin({ lat: "55.7" })).toThrow(/Invalid geo query/);
    expect(() => parseOrigin({ lat: "99", lng: "37" })).toThrow(/Invalid geo query/);
    expect(parseOrigin({ lat: "55.7", lng: "37.6" })).toEqual({ latitude: 55.7, longitude: 37.6 });
  });
});

describe("TodayController", () => {
  it("forwards the authenticated user and parsed origin", async () => {
    const calls: Array<{ userId: string; origin: GeoOrigin | null }> = [];
    const service = {
      digest: async (userId: string, _now: Date, origin: GeoOrigin | null) => {
        calls.push({ userId, origin });
        return response;
      },
    } as unknown as TodayService;
    const controller = new TodayController(service);
    await expect(controller.digest(user, { lat: "55.7", lng: "37.6" })).resolves.toEqual(response);
    expect(calls[0]).toEqual({ userId: user.id, origin: { latitude: 55.7, longitude: 37.6 } });
  });
});
