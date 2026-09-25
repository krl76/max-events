import { describe, expect, it } from "vitest";
import { moscowDateKey, moscowHour, moscowTimeLabel } from "./moscow-date";

describe("moscowDateKey", () => {
  it("uses Europe/Moscow, not UTC, around midnight", () => {
    expect(moscowDateKey(new Date("2026-09-12T21:30:00Z"))).toBe("2026-09-13");
    expect(moscowDateKey(new Date("2026-09-12T20:00:00Z"))).toBe("2026-09-12");
  });
});

describe("moscowHour", () => {
  it("returns the Moscow hour, three hours ahead of UTC", () => {
    expect(moscowHour(new Date("2026-09-12T13:00:00Z"))).toBe(16);
  });
});

describe("moscowTimeLabel", () => {
  it("shows the Moscow wall clock, three hours ahead of UTC", () => {
    expect(moscowTimeLabel(new Date("2026-09-12T16:45:00Z"))).toBe("19:45");
  });

  it("writes midnight as 00:00 rather than 24:00", () => {
    expect(moscowTimeLabel(new Date("2026-09-12T21:00:00Z"))).toBe("00:00");
  });

  it("pads single-digit hours and minutes", () => {
    expect(moscowTimeLabel(new Date("2026-09-12T02:05:00Z"))).toBe("05:05");
  });
});
