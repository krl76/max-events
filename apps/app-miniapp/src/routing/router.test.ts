import { describe, expect, it } from "vitest";
import { routeFromStartParam } from "./router";

describe("routeFromStartParam", () => {
  it("opens the event route from an event-* deep link", () => {
    expect(routeFromStartParam("event-42")).toEqual({ name: "event", id: "42" });
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
