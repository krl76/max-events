import { describe, expect, it } from "vitest";
import { moscowDateKey } from "./moscow-date";

describe("moscowDateKey", () => {
  it("uses Europe/Moscow, not UTC, around midnight", () => {
    expect(moscowDateKey(new Date("2026-09-12T21:30:00Z"))).toBe("2026-09-13");
    expect(moscowDateKey(new Date("2026-09-12T20:00:00Z"))).toBe("2026-09-12");
  });
});
