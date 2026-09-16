import { describe, expect, it, vi } from "vitest";
import { bridgeHandshake, getStartParam } from "./bridge";

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

describe("bridgeHandshake", () => {
  it("calls ready() exactly once on first mount", () => {
    const app = { ready: vi.fn() };

    expect(bridgeHandshake(app, false)).toBe(true);
    expect(bridgeHandshake(app, true)).toBe(true);
    expect(app.ready).toHaveBeenCalledTimes(1);
  });

  it("is a no-op outside the MAX client", () => {
    expect(bridgeHandshake(null, false)).toBe(false);
  });
});
