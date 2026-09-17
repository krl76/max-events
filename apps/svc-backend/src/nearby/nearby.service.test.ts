import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { haversineKm, nearbyBucket, NearbyService } from "./nearby.service";

const now = new Date("2026-09-12T14:00:00+03:00");
const placeId = "00000000-0000-4000-8000-0000000000a1";
const farPlaceId = "00000000-0000-4000-8000-0000000000a2";
const userId = "00000000-0000-4000-8000-00000000000a";

function place(id: string, lat: number, lng: number, category: PlaceEntity["category"] = "park"): PlaceEntity {
  return { id, title: id, address: "x", city: "Москва", category, latitude: lat, longitude: lng, published: true, createdAt: now, updatedAt: now } as PlaceEntity;
}

function event(id: string, startsAt: Date, pid: string, category: EventEntity["category"] = "afisha"): EventEntity {
  return {
    id,
    title: id,
    description: "",
    category,
    city: "Москва",
    placeId: pid,
    organizerUserId: null,
    startsAt,
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 0,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

describe("nearbyBucket", () => {
  it("assigns the four exclusive scale segments", () => {
    expect(nearbyBucket(new Date("2026-09-12T14:20:00+03:00"), now)).toBe("now");
    expect(nearbyBucket(new Date("2026-09-12T16:00:00+03:00"), now)).toBe("inAnHour");
    expect(nearbyBucket(new Date("2026-09-12T19:00:00+03:00"), now)).toBe("evening");
    expect(nearbyBucket(new Date("2026-09-13T12:00:00+03:00"), now)).toBe("tomorrow");
    expect(nearbyBucket(new Date("2026-09-12T13:00:00+03:00"), now)).toBeNull();
  });
});

describe("haversineKm", () => {
  it("is ~0 for the same point and grows with distance", () => {
    expect(haversineKm(55.75, 37.62, 55.75, 37.62)).toBeCloseTo(0, 5);
    expect(haversineKm(55.75, 37.62, 59.93, 30.31)).toBeGreaterThan(600);
  });
});

describe("NearbyService", () => {
  it("groups nearby events by bucket and drops far ones", async () => {
    const near = place(placeId, 55.751, 37.618);
    const far = place(farPlaceId, 59.93, 30.31);
    const events = [event("00000000-0000-4000-8000-0000000000e1", new Date("2026-09-12T14:20:00+03:00"), placeId), event("00000000-0000-4000-8000-0000000000e2", new Date("2026-09-12T19:00:00+03:00"), placeId), event("00000000-0000-4000-8000-0000000000e3", new Date("2026-09-12T14:20:00+03:00"), farPlaceId)];
    const service = new NearbyService({ find: async () => events } as unknown as Repository<EventEntity>, { find: async () => [near, far] } as unknown as Repository<PlaceEntity>, { find: async () => [] } as unknown as Repository<ParticipationEntity>, { friendIds: async () => new Set() } as unknown as FriendsService);
    const timeline = await service.timeline(55.75, 37.62, now);
    expect(timeline.now).toHaveLength(1);
    expect(timeline.evening).toHaveLength(1);
    expect(timeline.now[0]?.distanceKm).toBeLessThan(2);
    expect(timeline.inAnHour).toHaveLength(0);
  });

  it("builds a relax chain park → event → food inside the free window", async () => {
    const park = place(placeId, 55.751, 37.618, "park");
    const food = place("00000000-0000-4000-8000-0000000000a3", 55.752, 37.619, "food");
    const events = [event("00000000-0000-4000-8000-0000000000e1", new Date("2026-09-12T15:00:00+03:00"), placeId, "afisha")];
    const service = new NearbyService({ find: async () => events } as unknown as Repository<EventEntity>, { find: async () => [park, food] } as unknown as Repository<PlaceEntity>, { find: async () => [] } as unknown as Repository<ParticipationEntity>, { friendIds: async () => new Set() } as unknown as FriendsService);
    const options = await service.leisure(55.75, 37.62, 3, "relax", userId, now);
    expect(options).toHaveLength(1);
    expect(options[0]?.stops.map((stop) => stop.kind)).toEqual(["place", "event", "place"]);
    expect(options[0]?.title).toBe("Расслабиться");
  });
});
