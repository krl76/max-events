import { describe, expect, it } from "vitest";
import { getStartParam } from "./bridge";

describe("getStartParam", () => {
  it("returns start_param from initDataUnsafe", () => {
    expect(getStartParam({ initDataUnsafe: { start_param: "event-123" } })).toBe("event-123");
  });

  it("returns null outside MAX client", () => {
    expect(getStartParam(null)).toBeNull();
  });

  it("returns null when start_param is absent", () => {
    expect(getStartParam({ initDataUnsafe: {} })).toBeNull();
  });
});
