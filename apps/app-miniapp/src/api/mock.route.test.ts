import { afterEach, describe, expect, it } from "vitest";
import { AutoPlanProposalSchema, DayRouteSchema, OptimizeRouteSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { buildMockDayRoute, createMockAutoPlan, installMockApi, mockEvents, mockPlaces, optimizeMockDayRoute, planCard, resetMockPlans } from "./mock";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const PARK = mockPlaces[0];
const MUSEUM = mockPlaces[1];
const STADIUM = mockPlaces[2];
const PARK_EVENT = mockEvents.find((item) => item.placeId === PARK.id)!;
const NO_PLACE_EVENT = mockEvents.find((item) => item.placeId === null)!;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("createMockAutoPlan", () => {
  afterEach(() => {
    resetMockPlans();
  });

  it("builds the README dinner->road->meetup->event timeline and persists the draft plan", () => {
    const proposal = createMockAutoPlan({ eventId: PARK_EVENT.id, latitude: MOSCOW[0], longitude: MOSCOW[1] });
    expect(proposal).not.toBe("no_event");
    if (proposal === "no_event") return;

    expect(AutoPlanProposalSchema.safeParse(proposal).success).toBe(true);
    expect(proposal.timeline.map((step) => step.label)).toEqual(["ужин", "дорога", "встреча", "событие"]);
    expect(proposal.timeline[3].detail).toBe(PARK_EVENT.title);
    expect(proposal.timeline[0].at < proposal.timeline[1].at).toBe(true);
    expect(proposal.travelMinutes).toBeGreaterThan(0);
    expect(proposal.foodPlaces.length).toBeGreaterThan(0);
    expect(proposal.foodPlaces.every((place) => place.category === "food")).toBe(true);
    expect(proposal.plan.event.id).toBe(PARK_EVENT.id);
    expect(new Date(proposal.plan.plan.meetingAt).getTime()).toBeLessThan(new Date(PARK_EVENT.startsAt).getTime());
    expect(planCard(proposal.plan.plan.id)?.plan.id).toBe(proposal.plan.plan.id);
  });

  it("skips the dinner step and the food picks for an event without a venue", () => {
    const proposal = createMockAutoPlan({ eventId: NO_PLACE_EVENT.id, latitude: MOSCOW[0], longitude: MOSCOW[1] });
    expect(proposal).not.toBe("no_event");
    if (proposal === "no_event") return;

    expect(proposal.travelMinutes).toBe(0);
    expect(proposal.foodPlaces).toEqual([]);
    expect(proposal.timeline.map((step) => step.label)).toEqual(["дорога", "встреча", "событие"]);
  });

  it("returns no_event for an unknown event", () => {
    expect(createMockAutoPlan({ eventId: UNKNOWN_ID, latitude: MOSCOW[0], longitude: MOSCOW[1] })).toBe("no_event");
  });
});

describe("buildMockDayRoute / optimizeMockDayRoute", () => {
  const stops = [{ placeId: STADIUM.id }, { eventId: PARK_EVENT.id }, { placeId: MUSEUM.id }];

  it("resolves stops in order with the origin prepended as «Старт» and one leg per hop", () => {
    const route = buildMockDayRoute({ stops, latitude: MOSCOW[0], longitude: MOSCOW[1] });
    expect(typeof route).not.toBe("string");
    if (typeof route === "string") return;

    expect(DayRouteSchema.safeParse(route).success).toBe(true);
    expect(route.points.map((point) => point.title)).toEqual(["Старт", STADIUM.title, PARK_EVENT.title, MUSEUM.title]);
    expect(route.legs).toHaveLength(route.points.length - 1);
    route.legs.forEach((leg, index) => {
      expect(leg.fromTitle).toBe(route.points[index].title);
      expect(leg.toTitle).toBe(route.points[index + 1].title);
      expect(leg.travelMinutes).toBeGreaterThanOrEqual(0);
    });
    expect(route.totalMinutes).toBeGreaterThan(0);
    expect(route.totalKm).toBeGreaterThan(0);
    expect(route.points[2].at).not.toBeNull();
    expect(route.points[1].at).toBeNull();
  });

  it("builds a route without the origin point when no coordinates are given", () => {
    const route = buildMockDayRoute({ stops: [{ placeId: PARK.id }, { placeId: MUSEUM.id }] });
    expect(typeof route).not.toBe("string");
    if (typeof route === "string") return;

    expect(route.points.map((point) => point.title)).toEqual([PARK.title, MUSEUM.title]);
  });

  it("keeps the first point and never makes the route longer", () => {
    const result = optimizeMockDayRoute({ stops, latitude: MOSCOW[0], longitude: MOSCOW[1] });
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(OptimizeRouteSchema.safeParse(result).success).toBe(true);
    expect(result.optimized.totalKm).toBeLessThanOrEqual(result.original.totalKm);
    expect(result.optimized.totalMinutes).toBeLessThanOrEqual(result.original.totalMinutes);
    expect(result.savedMinutes).toBe(result.original.totalMinutes - result.optimized.totalMinutes);
    expect(result.savedKm).toBeCloseTo(result.original.totalKm - result.optimized.totalKm, 5);
    expect(result.optimized.points[0].title).toBe(result.original.points[0].title);
    expect(result.optimized.points.map((point) => point.title).sort()).toEqual(result.original.points.map((point) => point.title).sort());
  });

  it("reorders the stops when the given order is longer", () => {
    const result = optimizeMockDayRoute({ stops: [{ placeId: STADIUM.id }, { placeId: MUSEUM.id }], latitude: MOSCOW[0], longitude: MOSCOW[1] });
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(result.optimized.totalKm).toBeLessThan(result.original.totalKm);
    expect(result.savedMinutes).toBeGreaterThan(0);
    expect(result.optimized.points.map((point) => point.title)).toEqual(["Старт", MUSEUM.title, STADIUM.title]);
  });

  it("flags unknown events, unknown places and venue-less events", () => {
    expect(buildMockDayRoute({ stops: [{ eventId: UNKNOWN_ID }, { placeId: PARK.id }] })).toBe("no_event");
    expect(buildMockDayRoute({ stops: [{ placeId: UNKNOWN_ID }, { placeId: PARK.id }] })).toBe("no_place");
    expect(buildMockDayRoute({ stops: [{ eventId: NO_PLACE_EVENT.id }, { placeId: PARK.id }] })).toBe("event_without_place");
  });
});

describe("autoplan/route mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockPlans();
  });

  const client = () => new ApiClient("/api");

  it("serves the autoplan proposal through the typed client and lists the saved plan", async () => {
    restore = installMockApi();
    const api = client();

    const proposal = await api.createAutoPlan(PARK_EVENT.id, ...MOSCOW);

    expect(proposal.plan.event.id).toBe(PARK_EVENT.id);
    expect(proposal.timeline.length).toBeGreaterThanOrEqual(3);
    const plans = await api.listPlans();
    expect(plans.some((card) => card.plan.id === proposal.plan.plan.id)).toBe(true);
  });

  it("mirrors 404 for an unknown autoplan event and 400 for broken coordinates", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.createAutoPlan(UNKNOWN_ID, ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.createAutoPlan(PARK_EVENT.id, 91, 0)).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("serves build and optimize through the typed client", async () => {
    restore = installMockApi();
    const api = client();
    const stops = [{ placeId: STADIUM.id }, { placeId: MUSEUM.id }];

    const route = await api.createDayRoute(stops, ...MOSCOW);
    expect(route.points[0].title).toBe("Старт");
    expect(route.legs).toHaveLength(route.points.length - 1);

    const result = await api.optimizeDayRoute(stops, ...MOSCOW);
    expect(result.optimized.totalKm).toBeLessThanOrEqual(result.original.totalKm);
    expect(result.savedMinutes).toBe(result.original.totalMinutes - result.optimized.totalMinutes);
    expect(result.savedMinutes).toBeGreaterThan(0);
  });

  it("mirrors the backend 400 for out-of-contract stop lists", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.createDayRoute([{ placeId: PARK.id }], ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.optimizeDayRoute([{ placeId: PARK.id }], ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 400 });
    const nineStops = Array.from({ length: 9 }, () => ({ placeId: PARK.id }));
    await expect(api.createDayRoute(nineStops, ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.createDayRoute([{ eventId: PARK_EVENT.id, placeId: PARK.id }, { placeId: MUSEUM.id }], ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("mirrors 404 for unknown stops and 400 for a venue-less event", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.createDayRoute([{ eventId: UNKNOWN_ID }, { placeId: PARK.id }], ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.createDayRoute([{ placeId: UNKNOWN_ID }, { placeId: PARK.id }], ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.createDayRoute([{ eventId: NO_PLACE_EVENT.id }, { placeId: PARK.id }], ...MOSCOW)).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
