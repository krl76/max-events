import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { TravelOption } from "@max-events/api-contracts";
import type { RoutesService } from "./routes.service";
import { parseTravelQuery, TravelController } from "./travel.controller";

const parkId = "00000000-0000-4000-8000-0000000000a1";
const tiles: TravelOption[] = [
  { mode: "walk", minutes: 18, distanceKm: 1.4, transfers: null },
  { mode: "metro", minutes: 9, distanceKm: 1.4, transfers: 1 },
];

describe("parseTravelQuery", () => {
  it("reads placeId with latitude/longitude or lat/lng", () => {
    expect(parseTravelQuery({ placeId: parkId, latitude: "55.75", longitude: "37.62" })).toEqual({
      placeId: parkId,
      latitude: 55.75,
      longitude: 37.62,
    });
    expect(parseTravelQuery({ placeId: parkId, lat: "55.75", lng: "37.62" }).latitude).toBe(55.75);
  });

  it("rejects a lone coordinate, a missing place, or an out-of-range point", () => {
    expect(() => parseTravelQuery({ placeId: parkId, latitude: "55.75" })).toThrow(BadRequestException);
    expect(() => parseTravelQuery({ latitude: "55.75", longitude: "37.62" })).toThrow(BadRequestException);
    expect(() => parseTravelQuery({ placeId: "not-a-uuid", latitude: "55.75", longitude: "37.62" })).toThrow(BadRequestException);
    expect(() => parseTravelQuery({ placeId: parkId, latitude: "91", longitude: "37" })).toThrow(BadRequestException);
  });
});

describe("TravelController", () => {
  it("forwards a valid query to RoutesService", async () => {
    let called: { placeId: string; origin: { latitude: number; longitude: number } } | undefined;
    const routes = {
      travelToPlace: async (placeId: string, origin: { latitude: number; longitude: number }) => {
        called = { placeId, origin };
        return tiles;
      },
    } as unknown as RoutesService;
    const controller = new TravelController(routes);
    await expect(controller.options({ placeId: parkId, latitude: "55.75", longitude: "37.62" })).resolves.toEqual(tiles);
    expect(called).toEqual({ placeId: parkId, origin: { latitude: 55.75, longitude: 37.62 } });
  });
});
