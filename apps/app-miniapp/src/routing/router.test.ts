import { describe, expect, it } from "vitest";
import { routeFromStartParam } from "./router";

describe("routeFromStartParam", () => {
  it("opens the event route from an event-* deep link", () => {
    expect(routeFromStartParam("event-42")).toEqual({ name: "event", id: "42" });
  });

  it("opens the place route from a place-* deep link", () => {
    expect(routeFromStartParam("place-b0000001-0000-4000-8000-000000000001")).toEqual({ name: "place", id: "b0000001-0000-4000-8000-000000000001" });
  });

  it("falls back to home when the place id is empty", () => {
    expect(routeFromStartParam("place-")).toEqual({ name: "home" });
  });

  it("falls back to home without a start_param", () => {
    expect(routeFromStartParam(null)).toEqual({ name: "home" });
  });

  it("falls back to home for non-event start params", () => {
    expect(routeFromStartParam("promo_summer2025")).toEqual({ name: "home" });
  });

  it("falls back to home when the event id is empty", () => {
    expect(routeFromStartParam("event-")).toEqual({ name: "home" });
  });
});
