import { describe, expect, it } from "vitest";
import { CreateDayRouteWriteSchema, RouteStopWriteSchema } from "./route.js";

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
});
