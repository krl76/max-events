import { describe, expect, it } from "vitest";
import { CreateDayRouteWriteSchema, RouteLegSchema, RouteStopWriteSchema } from "./route.js";

describe("RouteStopWriteSchema", () => {
  it("requires exactly one of eventId or placeId", () => {
    expect(RouteStopWriteSchema.safeParse({}).success).toBe(false);
    expect(RouteStopWriteSchema.parse({ placeId: "018f3c5a-0000-7000-8000-000000000099" }).placeId).toBe("018f3c5a-0000-7000-8000-000000000099");
  });
});

describe("CreateDayRouteWriteSchema", () => {
  it("requires at least two stops", () => {
    expect(CreateDayRouteWriteSchema.safeParse({ stops: [{ placeId: "018f3c5a-0000-7000-8000-000000000099" }] }).success).toBe(false);
  });

  it("accepts a cheaper or no-taxi preference", () => {
    const stops = [{ placeId: "018f3c5a-0000-7000-8000-000000000099" }, { placeId: "018f3c5a-0000-7000-8000-000000000098" }];
    expect(CreateDayRouteWriteSchema.parse({ stops, prefer: "cheaper" }).prefer).toBe("cheaper");
    expect(CreateDayRouteWriteSchema.safeParse({ stops, prefer: "fastest" }).success).toBe(false);
  });
});

describe("RouteLegSchema", () => {
  it("defaults a walking unpaid leg with no transfers", () => {
    const parsed = RouteLegSchema.parse({ fromTitle: "A", toTitle: "B", travelMinutes: 18, distanceKm: 1.4 });
    expect(parsed).toMatchObject({ mode: "walk", transfers: 0, priceRub: null });
  });
});
