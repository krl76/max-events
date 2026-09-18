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

  it("opens the plan route from a plan-* deep link", () => {
    expect(routeFromStartParam("plan-p1")).toEqual({ name: "plan", id: "p1" });
  });

  it("opens the list route from a list-* deep link", () => {
    expect(routeFromStartParam("list-l1")).toEqual({ name: "list", id: "l1" });
  });

  it("opens the gathering route from a gathering-* deep link", () => {
    expect(routeFromStartParam("gathering-g1")).toEqual({ name: "gathering", id: "g1" });
  });

  it("falls back to home when the plan id is empty", () => {
    expect(routeFromStartParam("plan-")).toEqual({ name: "home" });
  });

  it("falls back to home for an unknown deep-link prefix", () => {
    expect(routeFromStartParam("foo-1")).toEqual({ name: "home" });
  });

  it("keeps the nearby screen out of start_param deep links", () => {
    expect(routeFromStartParam("nearby")).toEqual({ name: "home" });
  });

  it("keeps the day-route screen out of start_param deep links", () => {
    expect(routeFromStartParam("day-route")).toEqual({ name: "home" });
  });
});
