import { describe, expect, it } from "vitest";
import { entryCodeFromBookingId, normalizeEntryCode } from "./entry-code";

describe("entryCodeFromBookingId", () => {
  it("takes the last six hex digits of the booking id, uppercased", () => {
    expect(entryCodeFromBookingId("00000000-0000-4000-8000-0000000000c1")).toBe("0000C1");
  });
});

describe("normalizeEntryCode", () => {
  it("strips separators and uppercases, and treats leftover empty as empty", () => {
    expect(normalizeEntryCode(" 0000-c1 ")).toBe("0000C1");
    expect(normalizeEntryCode("0000c1")).toBe("0000C1");
    expect(normalizeEntryCode("   --  ")).toBe("");
  });
});
