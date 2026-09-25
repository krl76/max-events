import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { pickMode, shortestPermutation, toDayRoute, walkingMinutes } from "./routes.service";
import { RoutesService } from "./routes.service";

const now = new Date("2026-09-12T10:00:00Z");
const parkId = "00000000-0000-4000-8000-0000000000a1";
const foodId = "00000000-0000-4000-8000-0000000000a2";
const sportId = "00000000-0000-4000-8000-0000000000a3";

function place(id: string, title: string, lat: number, lng: number): PlaceEntity {
  return { id, title, address: title, city: "Москва", category: "park", published: true, latitude: lat, longitude: lng, createdAt: now, updatedAt: now } as PlaceEntity;
}

describe("walkingMinutes", () => {
  it("rounds meters at 80 m/min", () => {
    expect(walkingMinutes(0)).toBe(0);
    expect(walkingMinutes(160)).toBe(2);
  });
});

describe("pickMode", () => {
  it("walks short hops, takes metro then taxi, and drops taxi when asked", () => {
    expect(pickMode(400)).toBe("walk");
    expect(pickMode(3000)).toBe("metro");
    expect(pickMode(12000)).toBe("taxi");
    expect(pickMode(12000, "no_taxi")).toBe("metro");
    expect(pickMode(400, "cheaper")).toBe("walk");
  });
});

describe("shortestPermutation", () => {
  it("keeps the start and shortens a detour", () => {
    const start = { title: "Старт", at: null, latitude: 55.75, longitude: 37.62, eventId: null, placeId: null };
    const near = { title: "Близко", at: null, latitude: 55.751, longitude: 37.621, eventId: null, placeId: parkId };
    const far = { title: "Далеко", at: null, latitude: 55.8, longitude: 37.7, eventId: null, placeId: foodId };
    const original = [start, far, near];
    const optimized = shortestPermutation(original);
    expect(optimized[0]?.title).toBe("Старт");
    expect(toDayRoute(optimized).totalKm).toBeLessThanOrEqual(toDayRoute(original).totalKm);
  });
});

describe("RoutesService", () => {
  it("builds legs between two places", async () => {
    const places = {
      findOneBy: async (where: { id: string }) => (where.id === parkId ? place(parkId, "Парк", 55.73, 37.6) : where.id === foodId ? place(foodId, "Депо", 55.75, 37.62) : where.id === sportId ? place(sportId, "Лужники", 55.72, 37.55) : null),
    };
    const service = new RoutesService({ findOneBy: async () => null } as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>);
    const route = await service.build({ stops: [{ placeId: parkId }, { placeId: foodId }] });
    expect(route.points).toHaveLength(2);
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0]?.fromTitle).toBe("Парк");
    expect(route.totalMinutes).toBeGreaterThanOrEqual(0);
    const optimized = await service.optimize({
      stops: [{ placeId: parkId }, { placeId: sportId }, { placeId: foodId }],
      latitude: 55.75,
      longitude: 37.62,
    });
    expect(optimized.original.points[0]?.title).toBe("Старт");
    expect(optimized.savedKm).toBeGreaterThanOrEqual(0);
  });

  it("answers walk and metro tiles to a published place", async () => {
    const places = {
      findOneBy: async (where: { id: string }) => (where.id === parkId ? place(parkId, "Парк", 55.73, 37.6) : null),
    };
    const service = new RoutesService({ findOneBy: async () => null } as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>);
    const options = await service.travelToPlace(parkId, { latitude: 55.75, longitude: 37.62 });
    expect(options.map((row) => row.mode)).toEqual(["walk", "metro"]);
    expect(options[0]?.transfers).toBeNull();
    expect(options[1]?.minutes).toBeLessThan(options[0]!.minutes);
    expect(options[0]?.distanceKm).toBe(options[1]?.distanceKm);
    expect(options[0]?.distanceKm).toBeGreaterThan(0);
  });

  it("hides an unpublished place behind 404", async () => {
    const draft = { ...place(parkId, "Черновик", 55.73, 37.6), published: false };
    const places = { findOneBy: async (where: { id: string }) => (where.id === parkId ? draft : null) };
    const service = new RoutesService({ findOneBy: async () => null } as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>);
    await expect(service.travelToPlace(parkId, { latitude: 55.75, longitude: 37.62 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.travelToPlace(foodId, { latitude: 55.75, longitude: 37.62 })).rejects.toBeInstanceOf(NotFoundException);
  });
});
