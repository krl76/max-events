// START_MODULE_CONTRACT
// PURPOSE: In-memory city walks for the mock interceptor so unit tests never hit the network.
// SCOPE: Compose, list, get, and done. City "Пусто" answers 422 no_sights. Unknown ids are missing.
// DEPENDS: @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - composeMockWalk - mock POST /walks
// - listMockWalks - mock GET /walks, newest first
// - getMockWalk - mock GET /walks/:id
// - setMockWalkStopDone - mock PATCH /walks/:id/stops/:order
// - resetMockWalks - drop composed walks between tests
// END_MODULE_MAP

import { CityWalkSchema, type CityWalk, type ComposeCityWalkWrite } from "@max-events/api-contracts";

const PLACE_A = "11111111-1111-4111-8111-111111111111";
const PLACE_B = "22222222-2222-4222-8222-222222222222";

let walks: CityWalk[] = [];
let seq = 1;

export function resetMockWalks(): void {
  walks = [];
  seq = 1;
}

export function composeMockWalk(body: ComposeCityWalkWrite): CityWalk | "no_sights" {
  if (body.city === "Пусто") return "no_sights";
  const id = `c1000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  seq += 1;
  const walk = CityWalkSchema.parse({
    id,
    city: body.city,
    durationMinutes: body.durationMinutes,
    budgetMode: body.budgetMode,
    budgetRub: body.budgetRub,
    interests: body.interests,
    sourceLabel: "catalog",
    fitted: true,
    stops: [
      { order: 1, title: "Парк Горького", address: "Крымский Вал, Москва", latitude: 55.73, longitude: 37.6, description: `Место в городе ${body.city}.`, sourceUrl: `app://places/${PLACE_A}`, placeId: PLACE_A, done: false },
      { order: 2, title: "Нескучный сад", address: "Ленинский проспект, Москва", latitude: 55.735, longitude: 37.605, description: `Место в городе ${body.city}.`, sourceUrl: `app://places/${PLACE_B}`, placeId: PLACE_B, done: false },
    ],
    legs: [{ fromTitle: "Парк Горького", toTitle: "Нескучный сад", travelMinutes: 12, distanceKm: 0.8, mode: "walk", transfers: 0, priceRub: null }],
    createdAt: new Date().toISOString(),
  });
  walks = [walk, ...walks];
  return walk;
}

export function listMockWalks(): CityWalk[] {
  return walks;
}

export function getMockWalk(id: string): CityWalk | null {
  return walks.find((walk) => walk.id === id) ?? null;
}

export function setMockWalkStopDone(id: string, order: number, done: boolean): CityWalk | "missing" {
  const current = getMockWalk(id);
  if (current === null || !current.stops.some((stop) => stop.order === order)) return "missing";
  const next = CityWalkSchema.parse({
    ...current,
    stops: current.stops.map((stop) => (stop.order === order ? { ...stop, done } : stop)),
  });
  walks = walks.map((walk) => (walk.id === id ? next : walk));
  return next;
}
